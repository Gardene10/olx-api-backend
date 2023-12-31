const {v4: uuid} = require('uuid') // lib p gerar numero aleatorio
const jimp  = require('jimp') // lib para tratar a imagem recebida

//usando o model no controller
const Category = require('../models/Category')
const User = require('../models/User')
const Ad = require('../models/Ad')
const State = require('../models/State')
//funcao para pegar o buffer da imagem e manipular e salvar

const addImage = async (buffer) => {
    let newName = `${uuid()}.jpg`; //add codigo e altera a extensao da imagem
    let tmpImg = await jimp.read(buffer); // le a imagem
    tmpImg.cover(500,500).quality(80).write(`./public/media/${newName}`);//formata tamanho e salva
    return newName;
  };
module.exports = {
    // funcoes de Ads para o controller
    getCategories: async (req, res) => {
        const cats = await Category.find()// pega todas as categorias
        // listando as acategorias
        let categories = []
        for (let i in cats){
            categories.push({
                ...cats[i]._doc, //._doc pega o intem cru
                img: `${process.env.BASE}/assents/images/${cats[i].slug}.png`
            })
        }
        res.json({categories})
    },
    addAds: async (req, res) => {
        let { title, price, priceneg, desc, cat, token } = req.body;
        const user = await User.findOne({token}).exec();
        if(!title || !cat){
          res.json({error: 'Titulo e/ou Categora não foi enviado.'})
        }
        if(cat.length < 12){
          res.json({error:'ID de Categoria inesxistente'})
          return
        }
        const category = await Category.findById(cat)
        if(!category) {
          res.json({error:'Categoria inesxistente'})
          return

        }


        if(price){
          price = price.replace('.', '').replace(',','.').replace('R$ ', '');
          price = parseFloat(price);
        } else {
          price = 0;
        }
       
        const newAd = new Ad() ;// Cria uma nova instância do model Ad
        newAd.status = true;
        newAd.idUser = user._id;
        newAd.state = user.state;
        newAd.dataCreated = new Date() // data criada right now
        newAd.title = title;
        newAd.category = cat;
        newAd.price = price;
        newAd.priceNegotiable = (priceneg == 'true') ? true : false;
        newAd.description = desc;
        newAd.views = 0;
    
        if(req.files && req.files.img){
          if(req.files.img.length == undefined){ //verifica se e apenas um objeto

            if(['image/jpeg', 'image/jpg', 'image/png'].includes(req.files.img.mimetype)){

              let url = await addImage(req.files.img.data);
              newAd.images.push({
                url,
                default: false
              })
            }
          } else{
            for(let i = 0; i < req.files.img.length; i++){ //e  um array
              if(['image/jpeg', 'image/jpg', 'image/png'].includes(req.files.img[i].mimetype)){
                let url = await addImage(req.files.img[i].data);
                newAd.images.push({
                  url,
                  default: false
                })
              }
            }
          }
        }
       
    
        if(newAd.images.length > 0){
          newAd.images[0].default = true;
        }
    
        const info = await newAd.save();
        res.json({ id: info._id, newAd });

       
    
      },
    getAds: async (req, res) => {
        let {sort = 'asc', offset = 0, limit = 8, q, cat , state} = req.query
        let filters = {status: true}
        let total = 0

        if(q){
            filters.title = {'$regex': q, '$options': 'i'} // O 'i' torna a busca case-insensitiv
        }
        if(cat){
            const c = await Category.findOne({slug: cat}).exec()
            if(c){
                filters.category = c._id.toString()
            }
        }
        if(state){
            const s = await State.findOne({name: state.toUpperCase()}).exec()
            if(s){
                filters.state = s._id.toString()
            }
        }
       const adsTotal = await Ad.find(filters).exec()
       total = adsTotal.length

       const adsData = await Ad.find(filters)
            .sort({dateCreated: (sort == 'desc'?-1:1)})
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .exec()
        let ads = []
        for(let i in adsData){
            let image 
            let defaultImg = adsData[i].images.find(e => e.default) //funcao js normal p bucar um elemento dentro de um array
            if(defaultImg){ // verifica se tem a img defaut
                image = `${process.env.BASE}/media/${defaultImg.url}`// montando a url c a img padrao /array
            }else{
                image = `${process.env.BASE}/media/default.jpg` // montando a url c a img padrao/obj
            }
            ads.push({
                id: adsData[i]._id,
                title: adsData[i].title,
                price: adsData[i].price,
                priceNegotiable: adsData[i].priceNegotiable,
                image

            })
        }
        res.json({ads,total})

    },
    getItem: async (req, res) => {
        let {id , other = null} = req.query

        if(!id){
            res.json({error:'Sem produto'})
            return
        }
        if(id.length < 12){
            res.json({error: 'ID inválido'})
            return
        }
        const ad = await Ad.findById(id)
        if(!ad){
            res.json({error: 'Produto inexistente'})
            return
        }
        ad.views++
        await ad.save()

        let images = []
        for(let i in ad.images){
            images.push(`${process.env.BASE}/media/${ad.images[i].url}`) //url inteira da imagem
        }

        let category = await Category.findById(ad.category).exec()
        let userInfo = await User.findById(ad.idUser).exec()
        let stateInfo = await State.findById(ad.state).exec()

        let others = [] //pegando outros anuncios do mesmo usuario
        if(other){
          const otherData = await Ad.find().exec({status: true,idUser: ad.idUser}) //verificando se o id do autor do proprio anucio e verificando se ele esta ativo
          for(let i in otherData){
            if(otherData[i]._id.toString() != ad._id.toString()){ //exclui o proprio anuncio ja vizualizado

              let image = `${process.env.BASE}/media/default.jpg`
  
              let defaultImg = otherData[i].images.find(e => e.default) //buscando a imagem padrao se ñ achou mantem a anterior
              if(defaultImg) {
                image = `${process.env.BASE}/media/${defaultImg.url}`//se encontrou substitui a image pela padrao
              }

              others.push({
                id: otherData[i]._id,
                title: otherData[i].title,
                price: otherData[i].price,
                priceNegotiable: otherData[i].priceNegotiable,
                image

              })
            }

          }
        }


        res.json({
            id: ad._id,
            title: ad.title,
            price: ad.price,
            priceNegotiable: ad.priceNegotiable,
            description: ad.description,
            dateCreated: ad.dataCreated,
            views: ad.views,
            images,
            category,
            userInfo: {
                name:userInfo.name,
                email: userInfo.email
            },
            stateName: stateInfo.name,
            others
          
        })
        

    },
    editItem:  async (req, res) => {

      let {id} = req.params // quando pega pela url usa-se o params
      let {title,status,price,priceneg,desc,cat,images,token} = req.body //pegando pelo corpo da requisicao (o que o usuario digitou)

      if(id.length < 12){
        res.json({error: 'ID inválido'})
        return
      }
      const ad = await Ad.findById(id).exec()
      if(!ad){
        res.json({error: 'Anúncio inexistente'})
        return
      }
      const user = await User.findOne({token}).exec() //verificando se e o anucio do usuario logado
      if(user._id.toString() !== ad.idUser){
        res.json({error:'Este anuncio não é seu'})
        return
      }

      let updates = {}

      if(title){
        updates.title = title
      }
      if(price){
        price = price.replace('.', '').replace(',','.').replace('R$ ', '');
        price = parseFloat(price);
        updates.price = price
      }
      if(priceneg){
        updates.priceNegotiable = priceneg
      }
      if(status){
        updates.status = status
      }
      if(desc){
        updates.description = desc
      }
      if(cat){
        const category = await Category.findOne({slug: cat}).exec() //verificano se a categoria existe
        if(!category){
          res.json({error:'Categoria inexistente'})
          return
        }
        updates.category = category._id.toString()
      }
      if(images){
        updates.images = images
      }
      
      await Ad.findByIdAndUpdate(id,{$set: updates}) // encontra pelo id e faz um update em todas que estao com o updates

      if(req.files && req.files.img) {
        const adI = await Ad.findById(id);

        if(req.files.img.length == undefined) {
            if(['image/jpeg', 'image/jpg', 'image/png'].includes(req.files.img.mimetype)) {
                let url = await addImage(req.files.img.data);
                adI.images.push({
                    url,
                    default: false
                });
            }
        } else {
            for(let i=0; i < req.files.img.length; i++) {
                if(['image/jpeg', 'image/jpg', 'image/png'].includes(req.files.img[i].mimetype)) {
                    let url = await addImage(req.files.img[i].data);
                    adI.images.push({
                        url,
                        default: false
                    });
                }
            }
        }

        adI.images = [...adI.images];
        await adI.save();
    }

      res.json({error: 'Atualizado!'})
    },

    deleteItem: async (req, res) => {
      const { id } = req.params;
  
  
      try {
        
          const deletedAd = await Ad.findByIdAndDelete(id);
  
          if (!deletedAd) {
              res.status(404).json({ error: 'Anúncio não encontrado.' });
              return;
          }
  
          res.json({ message: 'Anúncio deletado com sucesso.' });
      } catch (error) {
          res.status(500).json({ error: 'Ocorreu um erro ao deletar o anúncio.' });
      }
  }
}
