var session = require('express-session')
var bodyParser = require('body-parser')
var express = require('express')
var https = require('https')
var http = require('http')
var path = require('path')
var fs = require('fs')

const booksPath = 'private/json/books.json'
const customersPath = 'private/json/customers.json'
const stuffPath = 'private/json/stuff.json'

function loadData(path){
    let rawdata = fs.readFileSync(path)
    return JSON.parse(rawdata)
}

function writeData(path, data){
    fs.writeFileSync(path, JSON.stringify(data))
}

function parseIds(arr, books){
    for (let i = 0; i < arr.length; ++i){
        let id = arr[i];
        arr[i] = books.ids[id]
        arr[i]["id"] = id
    }
    return arr
}

// Return all books with that part of name
// Words order matters
function searchByName(input){
    const search = '/' + input.toLowerCase() + '/g'
    const firstChar = input.charAt(0).toUpperCase()
    const books = loadData(booksPath)
    var result = []
    Object.keys(books.names[firstChar]).forEach(key => {
        if (key.match(eval(search)) !== null){
            result.push(books.names[firstChar][key]["id"])
        }
    })
    return parseIds(result, books)
}

// Return all book written by that author
// First name and Last name order doesn't matter
function searchByAuthor(input){
    const search = input.toLowerCase().split(' ')
    const firstChar = input.charAt(0).toUpperCase()
    const books = loadData(booksPath)
    var result = []
    Object.keys(books.authors[firstChar]).forEach(key => {
        let resultAppend = true
        for (part of search){
            if (!key.includes(part)){
                resultAppend = false
            }
        }
        console.log(resultAppend)
        if (resultAppend){
            for (let i = 0; i < books.authors[firstChar][key].length; ++i){
                result.push(books.authors[firstChar][key][i]["id"])
            }
        }
    })
    return parseIds(result, books)
}

// Add new book to database
function addBookToDB(author, name, quantity, bookId){
    var books = loadData(booksPath)
    // Add book to authors part
    const firstCharAuthor = author.charAt(0).toUpperCase()
    const booksByAuthor = books.authors[firstCharAuthor][author.toLowerCase()]
    if (typeof booksByAuthor === "undefined"){
        books.authors[firstCharAuthor][author.toLowerCase()] = []
    }
    books.authors[firstCharAuthor][author.toLowerCase()].push({"name":name, "id":bookId})

    // Add book to names part
    const firstCharName = name.charAt(0).toUpperCase()
    books.names[firstCharName][name.toLowerCase() + " " + author.toLowerCase()] = {"id":bookId}

    // Add book to ids part
    books.ids[bookId] = {
        "author": author,
        "name": name,
        "quantity": quantity
    }
    writeData(booksPath, books)
}

// Add new customer to database
function registerCustomer(fio){
    var customers = loadData(customersPath)
    customers.push({
        "name": fio,
        "booksCount": 0,
        "books": []
    })
    writeData(customersPath, customers)
}

// Search customer in database
function searchCustomer(fio, customers){
    for (var i = 0; i < customers.length; ++i){
        if (customers[i]["name"].toLowerCase() === fio.toLowerCase()){
            return i;
        }
    }
    return -1;
}

// Take book and add it to customer backpack
// If customer not rigestered -> autoregs him
function takeBook(bookId, fio){
    var customers = loadData(customersPath)
    var books = loadData(booksPath)
    const customerId = searchCustomer(fio, customers)
    if (customerId === -1){
        registerCustomer(fio)
    }
    if (books.ids[bookId]["quantity"] == 0){
        return false
    }
    customers[customerId]["booksCount"] += 1
    customers[customerId]["books"].push(bookId)
    books.ids[bookId]["quantity"] -= 1

    writeData(customersPath, customers)
    writeData(booksPath, books)
    return true
}

// Bring book back to database
function backBook(bookId, fio){
    var customers = loadData(customersPath)
    var books = loadData(booksPath)
    const customerId = searchCustomer(fio, customers)
    if (customerId === -1){
        return false
    }
    if (customers[customerId][books].includes(bookId)){
        customers[customerId][books] = customers[customerId][books].filter(function(value, index, arr){ 
            return value != bookId;
        });
    }
    customers[customerId][booksCount] -= 1
    books.ids[bookId]["quantity"] += 1

    writeData(customersPath, customers)
    writeData(booksPath, books)
    return true
}

/* SERVER PART */

const app = express()

app.set('views', path.join(__dirname+'/templates'));
app.set('view engine', 'ejs');

app.use(session({
    secret: 'LibrarySystemSecretPhrase',
    cookie: {
        maxAge: 31556952000
    },
    resave: false,
    saveUninitialized: false,
}))

app.use('/static', express.static('static'))
app.use(bodyParser.urlencoded({extended: true}))
app.use(express.json())

app.get('/', (req, res) => {
    res.status(200).sendFile(path.join(__dirname + '/private/index.html'))
})

app.get('/dashboard', (req, res) => {
    res.status(200).sendFile(path.join(__dirname + '/private/dashboard.html'))
})

app.get('/admin', (req, res) => {
    res.status(200).sendFile(path.join(__dirname + '/private/admin.html'))
})

app.get('/books', (req, res) => {
    var query = req.query.q
    var searchType = req.query.type
    var result
    if (searchType === "name"){
        result = searchByName(query)
    } else if (searchType === "author"){
        result = searchByAuthor(query)
    }
    res.status(200).json({status: '200', data: result})
})

app.use((req, res, next)=>{
    res.sendStatus(404)
});

app.listen(8080, () => {
    console.log(`Started server`)
});