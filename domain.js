 const debug=require("debug")
 debug.enable("*")
 require("dotenv").config()
 const ngrok = require('@ngrok/ngrok');
 ngrok.connect({ addr: 3000, authtoken_from_env: true })
	.then(listener => console.log(`Ingress established at: ${listener.url()}`));