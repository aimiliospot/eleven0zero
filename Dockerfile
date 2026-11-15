FROM node:22-slim AS ui
WORKDIR /ui
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npx vite build --outDir /static --emptyOutDir

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssh-client curl ca-certificates && rm -rf /var/lib/apt/lists/*
# boxd CLI: snapshots + clones for the fix test (auth: BOXD_TOKEN)
RUN curl -fsSL https://boxd.sh/downloads/install.sh | BOXD_INSTALL_DIR=/usr/local/bin sh
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/manage.py ./
COPY backend/config config
COPY backend/eleven0zero eleven0zero
COPY --from=ui /static ./static
ENV DB_PATH=/data/django.db PYTHONUNBUFFERED=1
COPY tools tools
COPY backend/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["sh", "/entrypoint.sh"]
CMD ["sh", "-c", "python manage.py migrate --noinput && exec python manage.py runserver 0.0.0.0:5000 --noreload"]
