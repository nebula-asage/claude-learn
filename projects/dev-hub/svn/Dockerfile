FROM alpine:3.22
RUN apk add --no-cache apache2 apache2-utils apache2-webdav mod_dav_svn subversion \
 && mkdir -p /svn /run/apache2
COPY httpd-svn.conf /etc/apache2/conf.d/svn.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
