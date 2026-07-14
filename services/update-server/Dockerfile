FROM python:3.13-alpine

WORKDIR /app
RUN addgroup -S workbuddy && adduser -S -G workbuddy workbuddy
COPY --chown=workbuddy:workbuddy server.py /app/server.py

USER workbuddy
EXPOSE 8790
CMD ["python", "-u", "/app/server.py"]
