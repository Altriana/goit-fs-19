import express from "express";
import path from "node:path";
import productsJson from "./products.json" with { type: "json" };

/* Postman Endpoints & Payload */
const app = express();

/* Parse Request Body Middleware */
app.use(express.json());

/* Expose /public directory to Serve: Static Assets & Web Client */
const publicPath = (...dirs) => path.join(import.meta.dirname, "public", ...dirs);
app.use("/assets", express.static(publicPath("assets")));
app.use("/", express.static(publicPath("client")));

/* CORS Middleware */
app.use((req, res, next) => {
    res.set({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Request-Method": "*",
        "Access-Control-Allow-Methods": "OPTIONS, GET, POST, PUT, PATCH, DELETE",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers",
        "Access-Control-Max-Age": 2_592_000,
    });
    next();
});

/* Logger Middleware */
app.use((req, res, next) => {
    const date = new Date().toISOString();
    const { method, originalUrl } = req;
    console.log(`${date} - [${method}] "${originalUrl}"`);
    next();
});


/* Util */
const _id = () => "_" + Math.round(Date.now() * Math.random()).toString(16).slice(2);

/* Discount codes Database */
const discountCodes = {
    "DUPA": 0.8,
};

/* Discount business logic */
// product
const applyDiscount = (req) => {
    const discountedRatio = discountCodes[req.query["discount"]?.toUpperCase()];
    
    return discountedRatio
        ? (product) => ({ ...product, price: parseFloat((product.price * discountedRatio).toFixed(2)) })
        : (product) => product;
};

/* Products Database */
const products = new Map([
    { id: "_jappko", category: "FOOD", name: "Apple", price: 42.20 },
    { id: _id(), category: "FOOD", name: "Banana", price: 13.37 },
    { id: _id(), category: "FOOD", name: "Corn", price: 0.69 },
    { id: _id(), category: "FURNITURE", name: "Sofa", price: 2400 },
    { id: _id(), category: "FURNITURE", name: "Chair", price: 1234 },
    ...productsJson.map(p => ({ id: _id(), ...p })),
].map(p => [p.id, p]));



/* Routes */

/* localhost:3000/products/unknown */
/* localhost:3000/products/_jappko */
/* localhost:3000/products/_jappko?discount=abc */
/* localhost:3000/products/_jappko?discount=dupa */
/* localhost:3000/products/_jappko?discount=DUPA */
app.get("/api/products/:id", (req, res) => {
    const id = req.params.id ?? null;
    
    const productById = products.get(id);
    
    if (!productById) return res.sendStatus(404);

    const requestedProduct = applyDiscount(req)(productById);

    return res.json(requestedProduct);
});

/* localhost:3000/products */
/* localhost:3000/products?category=dupa */
/* localhost:3000/products?category=FOOD */
/* localhost:3000/products?category=FURNITURE */
const filterByCategory = (req) => {
    const category = req.query["category"]?.toUpperCase() ?? null;
    return category
        ? (product) => product.category === category
        : () => true;
};
const isValidPagination = (number) => typeof number === "number" && !isNaN(number) && number > 0;
const paginate = (arr, req) => {
    const {
        limit: _limit = 10,
        page: _page = 1
    } = req.query;

    const limit = parseInt(_limit, 10);
    const page = parseInt(_page, 10);

    const isInvalidPagination = !isValidPagination(limit) || !isValidPagination(page);
    if (isInvalidPagination) return { page: 1, limit: 10, next: null, results: [] };

    const start = (page - 1) * limit;
    const end = start + limit;
    
    const next = (arr.length > limit*page) ? page+1 : null;

    const results = arr.slice(start, end);

    return { page, limit, next, results };
}
app.get("/api/products", (req, res) => {
    const requestedProducts = [...products.values()]
        .filter(filterByCategory(req))
        .map(applyDiscount(req));

    const paginatedResult = paginate(requestedProducts, req);

    return res.json(paginatedResult);
});

/* localhost:3000/products */
/* { "category": "FURNITURE", "name": "Desk", "price": 5000 } */
const requiredProductFields = ["category", "name", "price"];
app.post("/api/products", (req, res) => {
    const productFields = Object.keys(req.body);
    const isValidProduct = requiredProductFields
        .every(field => productFields.includes(field));
    if (!isValidProduct) return res.sendStatus(400);

    const id = _id();
    const createdProduct = { ...req.body, id };

    products.set(id, createdProduct);

    return res.status(201).json({ id });
});

/* localhost:3000/products/_jappko */
/* { "category": "FRUIT", "name": "Apfel", "price": 3.14 } */
app.put("/api/products/:id", (req, res) => {
    const id = req.params.id ?? null;
    if (!id) return res.sendStatus(404);
    
    const productById = products.get(id);
    
    if (!productById) return res.sendStatus(404);

    const productFields = Object.keys(req.body);
    const isValidProduct = requiredProductFields
        .every(field => productFields.includes(field));
    if (!isValidProduct) return res.sendStatus(400);

    const replacedProduct = { ...req.body, id };

    products.set(id, replacedProduct);

    return res.status(201).json(replacedProduct);
});

/* localhost:3000/products/_jappko */
/* { "price": 4.20 } */
app.patch("/api/products/:id", (req, res) => {
    const id = req.params.id ?? null;
    if (!id) return res.sendStatus(404);
    
    const productById = products.get(req.params.id);
    
    if (!productById) return res.sendStatus(404);

    const { category, name, price } = req.body;
    const updatedPartialProduct = {
        ...(category && { category }),
        ...(name && { name }),
        ...(price && { price }),
    };

    const updatedProduct = { ...productById, ...updatedPartialProduct, id };

    products.set(id, updatedProduct);

    return res.status(201).json(updatedProduct);
});

/* localhost:3000/products/_jappko */
app.delete("/api/products/:id", (req, res) => {
    const id = req.params.id ?? null;
    if (!id) return res.sendStatus(404);

    const productToDelete = products.has(id);
    if (!productToDelete) return res.sendStatus(404);

    products.delete(id);

    return res.sendStatus(204);
});

/* Starting the server */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    const startTime = new Date().toLocaleString();
    console.log(`[${startTime}] Starting server on port ${PORT}...`);
    console.log(`Server listening at ${cyan(`http://localhost:${PORT}`)}`);
    console.log(`Try to visit: ${cyan(`http://localhost:${PORT}/meme`)} ;)\n`);
});

/* https://stackoverflow.com/a/41407246 */
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;