var session = require('express-session')
var bodyParser = require('body-parser')
var express = require('express')
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

function hashCode(s){
    var h = 0, l = s.length, i = 0;
    if ( l > 0 )
        while (i < l)
            h = (h << 5) - h + s.charCodeAt(i++) | 0;
    return h;
};

function hashArray(arr){
    for (i of arr)
        i = hashCode(i)
    return arr
}

function search(searchSub, category){
    const books = loadData(booksPath)
    const searchSubHashcode = hashCode(searchSub)
    const searchSubL = searchSub.length
    var result = []
    if (category !== "authors" && category !== "names")
        return []
    for (booksPart of books[category]){
        const bookname = booksPart.name
        for (let i = 0; i <= bookname.length - searchSubL; i++){
            let namePartHashcode = hashCode(bookname.substring(i, i+searchSubL))
            if (namePartHashcode === searchSubHashcode){
                if (category === "names")
                    result.push(booksPart.id)
                else 
                    for (let i = 0; i < booksPart.books.length; ++i)
                        result.push(booksPart.books[i])
            }
        }
    }
    return parseIds(result, books)
}

function makeid(books){
    var result           = 'TRM-'
    var characters       = '0123456789'
    var charactersLength = characters.length
    for (var i = 0; i < 3; i++ ){
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    result += "-"
    for (var i = 0; i < 10; i++ ){
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    if (books["ids"].includes(result)){ 
        return makeid(books)
    }
    return result
}

// Add new book to database
function addBookToDB(author, name, quantity, bookId){
    var books = loadData(booksPath)
    if (author === "" || name === "" || quantity === 0)
        return false
    if (bookId === "undefined")
        bookId = makeid(books)

    const authorHash = hashArray(author.split(" "))
    const nameHash  = hashArray(name.split(" "))

    let ifAppended = false
    for (let i = 0; i < books.authors.length; ++i){
        if (authorHash === books.authors[i].hash){
            books.authors[i]["books"].push(bookId)
            ifAppended = true
            break
        }
    }
    if (!ifAppended){
        books.authors.push({"hash": authorHash, "books":[bookId]})
    }
    books.names.push({"hash": nameHash, "id": bookId})

    books.ids[bookId] = {
        "author": author,
        "name": name,
        "quantity": quantity
    }
    writeData(booksPath, books)
    return true
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
    let bookIndex = customers[customerId]["books"].indexOf(bookId)
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

app.post('/books', (req, res) => {
    var searchType = req.query.type
    var result
    if (searchType === "names" || searchType === "authors")
        result = search(req.body.data, searchType)
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

app.post('/books/add', (req, res) => {
    if (typeof req.session.stuffKey === "undefined"){
        return res.status(302).json({status: '302', message: 'Log in to continue'})
    }

    if (addBookToDB(req.body.bookAuthor, req.body.bookName, req.body.bookQ, req.body.bookId)){
        res.status(200).json({status: '200', message: `Book ${req.params.bookId} is successfully added`}) 
    } else {
        res.status(404).json({status: '404', message: 'Something went wrong while adding'})
    }
})

app.use((req, res, next)=>{
    res.sendStatus(404)
});

app.listen(8080, () => {
    console.log(`Started server`)
});