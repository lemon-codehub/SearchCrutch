rm -rf ../dist/* && mkdir -p ../dist/quickSearch
cp -r ../src/* ../dist/quickSearch
cp ../LICENSE ../dist/quickSearch/LICENSE
cd ../dist
zip -r quickSearch.zip quickSearch/
