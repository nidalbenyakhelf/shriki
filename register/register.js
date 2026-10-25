import { App } from "../home/home.js";
const {$,$$,fillFaculty,fillCampuses,fillYears,fillTypes,createAccount,parseList,toast,icons}=App;

function initRegister(){
  const form=$("#registerForm");if(!form)return;
  fillFaculty($("#facSelect"),false);fillCampuses($("#campusSelect"));fillYears($("#yearSelect"));fillTypes($("#typeSelect"));
  const urlKind=new URLSearchParams(location.search).get("kind");
  setKind(urlKind==="student"?"student":"team");
  $$("#kindTabs .seg-btn").forEach(b=>b.addEventListener("click",()=>setKind(b.dataset.kind)));
  function setKind(k){
    $$("#kindTabs .seg-btn").forEach(b=>b.classList.toggle("active",b.dataset.kind===k));
    $("#kindField").value=k;$("#paneTeam").hidden=k!=="team";$("#paneStudent").hidden=k!=="student";
  }
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(form),kind=fd.get("kind")||"team";
    const name=String(fd.get("name")||"").trim(),faculty=String(fd.get("faculty")||"").trim(),
          campus=String(fd.get("campus")||"").trim(),year=String(fd.get("year")||"").trim(),
          email=String(fd.get("email")||"").trim();
    if(!name)return toast("error","أدخل اسمك","");
    if(!faculty)return toast("error","اختر كليّتك","");
    if(!year)return toast("error","اختر سنتك","");
    if(!email)return toast("error","أدخل بريدك","");

    const profile={kind,name,faculty,campus,year};
    const contact={email,phone:String(fd.get("phone")||"").trim(),linkedin:String(fd.get("linkedin")||"").trim()};

    if(kind==="team"){
      const title=String(fd.get("title")||"").trim(),description=String(fd.get("description")||"").trim(),needed=String(fd.get("neededSpecialties")||"").trim();
      if(!title||!description)return toast("error","أدخل عنوان مشروعك ووصفه","");
      if(!needed)return toast("error","حدّد التخصّصات التي تنقصك","");
      Object.assign(profile,{title,description,projectType:fd.get("projectType"),neededSpecialties:parseList(needed),roleDescription:String(fd.get("roleDescription")||"").trim()});
    }else{
      const specialty=String(fd.get("specialty")||"").trim();
      if(!specialty)return toast("error","أدخل تخصّصك","");
      Object.assign(profile,{specialty,skills:parseList(fd.get("skills")),bio:String(fd.get("bio")||"").trim()});
    }

    const btn=form.querySelector('button[type="submit"]');const old=btn?btn.innerHTML:"";
    if(btn){btn.disabled=true;btn.innerHTML='<i data-lucide="loader-2" class="spin"></i> جارٍ النشر…';icons()}
    try{
      const acc=await createAccount(profile,contact);
      $("#resultCode").textContent=acc.code;
      $("#copyCode").setAttribute("data-copy",acc.code);
      $("#goDash").href="../dashboard/dashboard.html";
      const sp=$("#shareProj");
      if(sp)sp.onclick=()=>App.sharePage(acc.title||acc.name,(acc.description||"").slice(0,120)+" — ابحث عن فريقك على «شريك».");
      form.hidden=true;$("#successState").hidden=false;icons();
      toast("success","تمّ النشر!","رمزك العامّ للبحث والتواصل هو "+acc.code);
    }catch(err){
      console.error(err);
      toast("error","تعذّر النشر",err&&err.message?String(err.message).slice(0,80):"أعد المحاولة.");
    }finally{if(btn){btn.disabled=false;btn.innerHTML=old;icons()}}
  });
  icons();
}
initRegister();