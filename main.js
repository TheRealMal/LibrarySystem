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
    var firstCharsAuthor = author.split(' ')
    var booksByAuthor = undefined
    firstCharsAuthor.forEach(part => {
        part = part.charAt(0).toUpperCase()
        if (typeof books.authors[part][author.toLowerCase()] !== "undefined"){
            booksByAuthor = books.authors[part][author.toLowerCase()]
        }
    })
    if (typeof booksByAuthor === "undefined"){
        firstCharsAuthor.forEach(letter => {
            books.authors[letter][author.toLowerCase()] = []
        })
    }
    firstCharsAuthor.forEach(letter => {
        books.authors[letter][author.toLowerCase()].push({"name":name, "id":bookId})
    })

    // Add book to names part
    var firstCharsName = author.split(' ')
    firstCharsName.forEach(part => {
        part = part.charAt(0).toUpperCase()
        books.names[part][name.toLowerCase() + " " + author.toLowerCase()] = {"id":bookId}  
    })

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
    customers[fio.toLowerCase()] = {
        "booksCount": 0,
        "books": []
    }
    writeData(customersPath, customers)
}

// Search customer in database
function searchCustomer(fio, customers){
    console.log(customers[fio.toLowerCase()])
    if (typeof customers[fio.toLowerCase()] !== "undefined"){
        return fio.toLowerCase()
    }
    return -1
}

// Take book and add it to customer backpack
function takeBook(bookId, fio){
    var customers = loadData(customersPath)
    var books = loadData(booksPath)
    const customerId = searchCustomer(fio, customers)
    if (customerId === -1 || typeof books.ids[bookId] === "undefined"){
        return false
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
function returnBook(bookId, fio){
    var customers = loadData(customersPath)
    var books = loadData(booksPath)
    const customerId = searchCustomer(fio, customers)
    if (customerId === -1 || typeof books.ids[bookId] === "undefined"){
        return false
    }
    let bookIndex = customers[customerId]["books"].indexOf(bookId);
    if (bookIndex > -1){
        customers[customerId]["books"].splice(bookIndex, 1)
        customers[customerId]["booksCount"] -= 1
        books.ids[bookId]["quantity"] += 1
        writeData(customersPath, customers)
        writeData(booksPath, books)
    }
    return true
}

/* SERVER PART */

const app = express()

app.set('views', path.join(__dirname+'/private/ejs'));
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

app.get('/dashboard/login', (req, res) => {
    res.status(200).sendFile(path.join(__dirname + '/private/dashboardAuth.html'))
})

app.post('/dashboard/login', (req, res) => {
    var customerFio = req.body.fio
    if (customerFio === "deauthCustomer"){
        req.session.student = undefined
        return res.sendStatus(205)
    }
    var customers = loadData(customersPath)
    var customer = searchCustomer(customerFio, customers)
    console.log(customer)
    if (customer !== -1){
        req.session.student = customerFio
        return res.sendStatus(200)
    } else {
        registerCustomer(customerFio)
        req.session.student = customerFio
        return res.sendStatus(200)
    }
})

app.get('/dashboard', (req, res) => {
    if (typeof req.session.student === "undefined"){
        return res.redirect(302, '/dashboard/login')
    }
    res.status(200).sendFile(path.join(__dirname + '/private/dashboard.html'))
})

app.get('/student', (req, res) => {
    if (typeof req.session.student === "undefined"){
        return res.redirect(302, '/dashboard/login')
    }
    var customers = loadData(customersPath)
    let customer = customers[req.session.student.toLowerCase()]
    if (customer["books"] !== []){
        var books = loadData(booksPath)
        customer["books"] = parseIds(customer["books"], books)
    }
    customer["name"] = req.session.student
    res.status(200).json(customer)
})

app.get('/admin/login', (req, res) => {
    res.status(200).sendFile(path.join(__dirname + '/private/adminAuth.html'))
})

app.post('/admin/login', (req, res) => {
    var stuffKey = req.body.key
    var stuffs = loadData(stuffPath)
    if (stuffs.includes(stuffKey)){
        req.session.stuffKey = stuffKey
        return res.sendStatus(200)
    }
    res.sendStatus(404)
})

app.get('/admin', (req, res) => {
    if (typeof req.session.stuffKey === "undefined"){
        return res.redirect(302, '/admin/login')
    }
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

app.get('/takenBooks', (req, res) => {
    if (typeof req.session.stuffKey === "undefined"){
        return res.redirect(302, '/admin/login')
    }
    var takenBooks = {}
    var customers = loadData(customersPath)
    var books = loadData(booksPath)
    Object.keys(customers).forEach(key => {
        if (customers[key]["booksCount"] > 0){
            takenBooks[key] = parseIds(customers[key]["books"], books)
        }
    });
    res.status(200).json({status: '200', data: takenBooks})
})

app.post('/books/take/:bookId', (req, res) => {
    if (typeof req.session.student === "undefined"){
        return res.status(302).json({status: '302', message: 'Log in to continue'})
    }
    if (takeBook(req.params.bookId, req.session.student)){
        res.status(200).json({status: '200', message: `Book ${req.params.bookId} is successfully taken`}) 
    } else {
        res.status(404).json({status: '404', message: 'Something went wrong while taking'})
    }
})

app.post('/books/return/:bookId', (req, res) => {
    if (typeof req.session.student === "undefined"){
        return res.status(302).json({status: '302', message: 'Log in to continue'})
    }
    if (returnBook(req.params.bookId, req.session.student)){
        res.status(200).json({status: '200', message: `Book ${req.params.bookId} is successfully returned`}) 
    } else {
        res.status(404).json({status: '404', message: 'Something went wrong while returning'})
    }
})

app.use((req, res, next)=>{
    res.sendStatus(404)
});

app.listen(8080, () => {
    console.log(`Started server`)
});