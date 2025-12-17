const t=(modul)=>{
    const e=require(modul).default
    new e()
          .get("/", () => 'hi')
          .listen(3000)
}
t("elysia")