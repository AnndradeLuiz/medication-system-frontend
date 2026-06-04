# Hospedagem com Nginx (Servindo arquivos estáticos diretamente)
FROM nginx:alpine

# Remove os arquivos padrão do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia todos os arquivos do front-end diretamente para o Nginx
# Isso substitui o "Live Server" perfeitamente e resolve o problema dos arquivos não encontrados
COPY . /usr/share/nginx/html

# Expõe a porta 80
EXPOSE 80
