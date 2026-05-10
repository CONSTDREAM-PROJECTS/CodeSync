FROM php:8.2-apache

# Enable Apache modules
RUN a2enmod rewrite headers

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql mysqli

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy project files
COPY . /var/www/html/

# Install PHPMailer via Composer
WORKDIR /var/www/html
RUN composer install --no-dev --optimize-autoloader

# Fix permissions
RUN chown -R www-data:www-data /var/www/html/

EXPOSE 80
