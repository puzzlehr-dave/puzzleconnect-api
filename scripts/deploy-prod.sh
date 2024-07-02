
echo 'App deployment in progress...'
rsync -a dist root@api.crm.geekydevelopment.com:/root
ssh -t -q root@api.crm.geekydevelopment.com < scripts/restart.sh > output.txt
rm output.txt
echo '✅ App deployment completed'
