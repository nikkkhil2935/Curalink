FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates tesseract-ocr && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY rag ./rag
COPY start.sh .
RUN chmod +x start.sh

VOLUME ["/app/chroma_store"]

EXPOSE 8001

CMD ["./start.sh"]