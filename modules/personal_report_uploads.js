// 个人报告图片只保存在当前设备的浏览器 IndexedDB 中，不上传服务器。
// 同一成员、同一月份最多 3 张；保存 Blob，避免 localStorage 的小容量限制。
const DB_NAME = "creative-personal-report-media";
const STORE_NAME = "monthly-images";

function openDatabase(){
  return new Promise((resolve,reject)=>{
    if(!("indexedDB" in window)){
      reject(new Error("当前浏览器不支持本地图片保存"));
      return;
    }
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error || new Error("无法打开本地图片存储"));
  });
}
function withStore(mode,run){
  return openDatabase().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_NAME,mode);
    const store=tx.objectStore(STORE_NAME);
    const request=run(store);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error || new Error("本地图片读写失败"));
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>db.close();
    tx.onabort=()=>db.close();
  }));
}
export async function loadReportUploads(key){
  const data=await withStore("readonly",store=>store.get(key));
  return Array.isArray(data)?data.filter(x=>x && x.blob instanceof Blob && typeof x.id==="string"):[];
}
export async function saveReportUploads(key,items){
  const data=(items || []).slice(0,3).map(x=>({id:x.id,name:x.name,blob:x.blob}));
  await withStore("readwrite",store=>store.put(data,key));
}
export function uploadAssetFromBlob(item){
  return {id:item.id,source:"upload",name:item.name,url:URL.createObjectURL(item.blob),tags:[]};
}
