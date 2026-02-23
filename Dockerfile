FROM python:3.11-slim

WORKDIR /app

COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

ENV PYTHONUNBUFFERED=1

EXPOSE 8080
VOLUME /app/data
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "120", "app.app:app"]
