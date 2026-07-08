import type { ComputerAuthorizationMode } from "../../config/schema";
import type { ToolDefinition, ToolRisk } from "./ToolTypes";

export function riskToSensitivity(risk: ToolRisk): "normal" | "sensitive" {
  return risk === "low" || risk === "medium" ? "normal" : "sensitive";
}

export function isSensitiveTool(definition: ToolDefinition): boolean {
  return riskToSensitivity(definition.risk) === "sensitive";
}

export function shouldAutoRunTool(mode: ComputerAuthorizationMode, definition: ToolDefinition): boolean {
  if (mode === "fullAccess") return true;
  if (mode === "denySensitive") return !isSensitiveTool(definition);
  return !isSensitiveTool(definition);
}

export function shouldBlockTool(mode: ComputerAuthorizationMode, definition: ToolDefinition): boolean {
  return mode === "denySensitive" && isSensitiveTool(definition);
}
