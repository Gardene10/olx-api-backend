
// conexao com o DB 
require('dotenv').config()
const express = require('express')
const mongose = require('mongoose')
const cors = require('cors')
const fileupload = require('express-fileupload')

mongose.connect(process.env.DATABASE , {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
mongose.Promise = global.Promise
mongose.connection.on('error',(error => {
    console.log("Error: ", error.message)
}))

//criando o servidor

const server = express()
server.use(cors())
server.use(express.json())
server.use(express.urlencoded({extended:true}))
server.use(fileupload())

server.use(express.static(__dirname+'/public'))

server.get('/ping',(req,res)=>{
    res.json({pong:true})
})

server.listen(process.env.PORT, ()=>{
    console.log(`Rodando no endereço: ${process.env.BASE}`)
})