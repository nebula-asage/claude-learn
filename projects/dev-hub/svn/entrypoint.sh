#!/bin/sh
set -e
# 空のボリュームなら最初のリポジトリ "main" を作る
if [ -z "$(ls -A /svn)" ]; then
  svnadmin create /svn/main
fi
chown -R apache:apache /svn
exec httpd -D FOREGROUND
