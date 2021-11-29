import requests
import json
from bs4 import BeautifulSoup
import random
import io
import string
booksPath = 'private/json/books.json'

parsedBooks = []
n = 0

for x in range(1, 20):
    r = BeautifulSoup(requests.get('https://www.100bestbooks.ru/index.php?page={}'.format(x)).text, 'lxml').find_all('tr', attrs={'itemprop':'itemListElement'})
    for xBook in r:
        notToAdd = False
        n += 1
        xBook = xBook.find_all('td')[1]
        bookAuthor = xBook.find_all('a')[0].find('span').get_text().replace("(", "").replace(")", "").replace("C", "С").replace('  ', ' ').replace('«', '"').replace('»', '"')
        bookName = xBook.find_all('a')[1].find('span').get_text().replace("№", "Номер").replace("(", "").replace(")", "").replace("C", "С").replace('  ', ' ').replace('«', '"').replace('»', '"')
        bookId = 'TRM-{}-{}'.format(n, random.getrandbits(32))
        for letter in string.ascii_lowercase:
            if letter in bookName.lower() or letter in bookAuthor.lower():
                notToAdd = True
                break
        if not notToAdd:
            parsedBooks.append({'author': bookAuthor, 'name': bookName, 'id': bookId})
        #print('{} - {} [{}]'.format(bookAuthor, bookName, bookId))


with io.open(booksPath, encoding='utf-8') as f:
    data = json.load(f)
    for book in parsedBooks:
        # Authors part
        for x in book["author"].split(' '):
            if x != "":
                if data["authors"][x[0].upper()].get(book["author"].lower(), None) != None:
                    data["authors"][x[0].upper()][book["author"].lower()].append({'name': book["name"], 'id': book["id"]})
                else:
                    data["authors"][x[0].upper()][book["author"].lower()] = [{'name': book["name"], 'id': book["id"]}]
        
        # Names part
        for x in ("{} {}".format(book["name"], book["author"])).split(' '):
            if x != "" and x != "—" and x != "-":
                data["names"][x[0].upper()]["{} {}".format(book["name"], book["author"]).lower()] = {'id': book["id"]}
        
        # Ids part
        data["ids"][book["id"]] = {'author': book["author"], 'name': book["name"], 'quantity': random.randint(5, 100)}
    
    with open('parsedBooks.json', 'w') as outfile:
        json.dump(data, outfile, sort_keys=True, indent=2, ensure_ascii=False)



