const lt=require("localtunnel")
const http=require("https")
lt({port:3000,subdomain:"partagesiochaptal"}).then(tunnel=>{
    console.log("tunnel url:",tunnel.url)
    require("fs").writeFileSync("tunnel.txt",tunnel.url)
    // Autorise tous les certificats (attention : sécurité réduite)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    http.get("https://loca.lt/185.233.130.41", {
        headers: {
            "Host": "partages.io",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1"
        }
    }).on("response", res => {
        console.log("statusCode:", res.statusCode)
        console.log("headers:", res.headers)
        res.on("data", d => {
            process.stdout.write(d)
        })
    }).on("error", e => {
        console.error(e)
    })
}).catch(e=>{
    console.error(e)
})