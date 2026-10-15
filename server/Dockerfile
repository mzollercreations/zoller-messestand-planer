# KI-Server des ZOLLER Messestand-Planers – portabel für den Betrieb auf ZOLLER-Infrastruktur
#   docker build -t zoller-msp-ki server/
#   docker run -p 8850:8850 -e ANTHROPIC_API_KEY=… -e MSP_ALLOWED_ORIGINS=https://… zoller-msp-ki
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY assist.py catalog.json ./
ENV MSP_PORT=8850
EXPOSE 8850
USER nobody
CMD ["python", "assist.py"]
