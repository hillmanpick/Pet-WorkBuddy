#Requires -Version 7.0
param(
    [switch]$Watch,
    [string]$RepoRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$ProcDumpPath = (Join-Path $env:TEMP "WorkBuddyDiag\procdump64.exe"),
    [string]$SessionDirectory
)

$ErrorActionPreference = "Stop"
$appExecutable = Join-Path $RepoRoot "apps\desktop\src-tauri\target\debug\WorkBuddy.exe"
$viteEntry = Join-Path $RepoRoot "apps\desktop\node_modules\vite\bin\vite.js"

if (-not $Watch) {
    foreach ($requiredFile in @($appExecutable, $viteEntry, $ProcDumpPath)) {
        if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
            throw "Required file is missing: $requiredFile. Build the desktop app and provide ProcDump first."
        }
    }
    if (Get-Process WorkBuddy -ErrorAction SilentlyContinue) {
        throw "WorkBuddy is already running. Close it before starting a monitored session."
    }
    $sessionId = (Get-Date -Format "yyyyMMdd-HHmmss") + "-" + [guid]::NewGuid().ToString("N").Substring(0, 6)
    $SessionDirectory = Join-Path $env:LOCALAPPDATA "WorkBuddy\diagnostics\$sessionId"
    New-Item -ItemType Directory -Path $SessionDirectory -Force | Out-Null
    $watcher = Start-Process -FilePath (Join-Path $PSHOME "pwsh.exe") -ArgumentList @(
        "-NoProfile", "-File", "`"$PSCommandPath`"", "-Watch",
        "-RepoRoot", "`"$RepoRoot`"", "-ProcDumpPath", "`"$ProcDumpPath`"",
        "-SessionDirectory", "`"$SessionDirectory`""
    ) -WindowStyle Hidden -PassThru
    [pscustomobject]@{ WatcherPid = $watcher.Id; SessionDirectory = $SessionDirectory }
    return
}

$sessionLog = Join-Path $SessionDirectory "session.jsonl"
function Write-SessionEvent([string]$Kind, [hashtable]$Details = @{}) {
    $event = @{ time = [DateTimeOffset]::Now.ToString("o"); kind = $Kind; watcherPid = $PID }
    foreach ($key in $Details.Keys) { $event[$key] = $Details[$key] }
    $event | ConvertTo-Json -Compress -Depth 5 | Add-Content -LiteralPath $sessionLog -Encoding utf8
}

function Start-CapturedProcess([string]$Executable, [string[]]$ProcessArguments, [string]$WorkingDirectory, [string]$LogPrefix) {
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $process.StartInfo.FileName = $Executable
    $process.StartInfo.WorkingDirectory = $WorkingDirectory
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    foreach ($argument in $ProcessArguments) { $process.StartInfo.ArgumentList.Add($argument) }
    if (-not $process.Start()) { throw "Failed to start $Executable" }
    # Drain both pipes asynchronously to avoid blocking the desktop app or the debugger.
    $outFile = [System.IO.File]::Open((Join-Path $SessionDirectory "$LogPrefix.out.log"), 'CreateNew', 'Write', 'Read')
    $errFile = [System.IO.File]::Open((Join-Path $SessionDirectory "$LogPrefix.err.log"), 'CreateNew', 'Write', 'Read')
    return [pscustomobject]@{
        Process = $process
        OutTask = $process.StandardOutput.BaseStream.CopyToAsync($outFile)
        ErrTask = $process.StandardError.BaseStream.CopyToAsync($errFile)
        OutFile = $outFile
        ErrFile = $errFile
    }
}

function Complete-CapturedProcess($Captured) {
    $Captured.Process.WaitForExit()
    try {
        $Captured.OutTask.GetAwaiter().GetResult()
        $Captured.ErrTask.GetAwaiter().GetResult()
    } finally {
        $Captured.OutFile.Dispose()
        $Captured.ErrFile.Dispose()
    }
}

$frontend = $null
$app = $null
$debugger = $null
try {
    Write-SessionEvent "starting" @{ executable = $appExecutable; sha256 = (Get-FileHash -LiteralPath $appExecutable -Algorithm SHA256).Hash }
    $frontend = Start-CapturedProcess (Get-Command node.exe -ErrorAction Stop).Source @(
        $viteEntry, "--host", "127.0.0.1", "--port", "5176", "--strictPort"
    ) (Join-Path $RepoRoot "apps\desktop") "frontend"

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($frontend.Process.HasExited) { throw "Frontend exited before launch; see frontend.err.log." }
        try {
            $response = Invoke-WebRequest "http://127.0.0.1:5176/" -TimeoutSec 1
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 300
    }
    if (-not $ready) { throw "Frontend failed to start on port 5176; see frontend logs." }
    Write-SessionEvent "frontend-ready" @{ frontendPid = $frontend.Process.Id; url = "http://127.0.0.1:5176/" }

    $app = Start-CapturedProcess $appExecutable @() (Split-Path $appExecutable -Parent) "desktop"
    $debugger = Start-CapturedProcess $ProcDumpPath @(
        "-accepteula", "-ma", "-e", $app.Process.Id.ToString(), $SessionDirectory
    ) $RepoRoot "procdump"
    Write-SessionEvent "desktop-started" @{ appPid = $app.Process.Id; frontendPid = $frontend.Process.Id; procdumpPid = $debugger.Process.Id }

    $frontendExitRecorded = $false
    $debuggerExitRecorded = $false
    $lastHeartbeat = [datetime]::MinValue
    while (-not $app.Process.WaitForExit(1000)) {
        if ($frontend.Process.HasExited -and -not $frontendExitRecorded) {
            Write-SessionEvent "frontend-exited" @{ exitCode = $frontend.Process.ExitCode }
            $frontendExitRecorded = $true
        }
        if ($debugger.Process.HasExited -and -not $debuggerExitRecorded) {
            Write-SessionEvent "procdump-exited" @{ exitCode = $debugger.Process.ExitCode }
            $debuggerExitRecorded = $true
        }
        if (((Get-Date) - $lastHeartbeat).TotalSeconds -ge 30) {
            $app.Process.Refresh()
            Write-SessionEvent "heartbeat" @{
                appPid = $app.Process.Id; responding = $app.Process.Responding
                memoryBytes = $app.Process.WorkingSet64; cpuSeconds = $app.Process.TotalProcessorTime.TotalSeconds
                frontendAlive = -not $frontend.Process.HasExited; procdumpAlive = -not $debugger.Process.HasExited
            }
            $lastHeartbeat = Get-Date
        }
    }
    Write-SessionEvent "desktop-exited" @{ appPid = $app.Process.Id; exitCode = $app.Process.ExitCode; exitCodeHex = ('0x{0:X8}' -f $app.Process.ExitCode) }
    Get-Content (Join-Path $env:LOCALAPPDATA "WorkBuddy\logs\workbuddy.log") -Tail 100 |
        Set-Content (Join-Path $SessionDirectory "application-tail.log") -Encoding utf8
    if ($app.Process.ExitCode -ne 0) {
        # Keep the matching binary and symbols for an abnormal exit before another build replaces them.
        foreach ($source in @($appExecutable, (Join-Path (Split-Path $appExecutable -Parent) "workbuddy.pdb"))) {
            if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination $SessionDirectory }
        }
    }
    Complete-CapturedProcess $app
    Complete-CapturedProcess $debugger
} catch {
    Write-SessionEvent "watcher-error" @{ message = $_.Exception.Message; stack = $_.ScriptStackTrace }
} finally {
    # Stop only the Vite process this watcher created, after the desktop has exited or launch failed.
    if ($frontend -and -not $frontend.Process.HasExited -and (-not $app -or $app.Process.HasExited)) {
        $frontend.Process.Kill()
    }
    Write-SessionEvent "watcher-finished" @{}
}
