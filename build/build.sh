rm -rf ../dist/* && mkdir -p ../dist/quickSearch
cp -r ../src/* ../dist/quickSearch
cd ../dist
zip -r quickSearch.zip quickSearch/