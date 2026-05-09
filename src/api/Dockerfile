FROM php:8.2-apache

RUN a2enmod rewrite headers

RUN docker-php-ext-install pdo pdo_mysql mysqli

COPY . /var/www/html/

RUN chown -R www-data:www-data /var/www/html/

RUN { \
    echo '<VirtualHost *:80>'; \
    echo '    DocumentRoot /var/www/html'; \
    echo '    <Directory /var/www/html>'; \
    echo '        AllowOverride All'; \
    echo '        Require all granted'; \
    echo '    </Directory>'; \
    echo '    Header always set Access-Control-Allow-Origin "https://codesynch.tech"'; \
    echo '    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"'; \
    echo '    Header always set Access-Control-Allow-Headers "Content-Type, Authorization"'; \
    echo '    RewriteEngine On'; \
    echo '    RewriteCond %{REQUEST_METHOD} OPTIONS'; \
    echo '    RewriteRule ^ - [R=200,L]'; \
    echo '</VirtualHost>'; \
} > /etc/apache2/sites-available/000-default.conf

EXPOSE 80
