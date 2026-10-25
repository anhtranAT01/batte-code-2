let opening;
export function database() {
  if (!opening) opening=new Promise((resolve,reject)=>{
    const request=indexedDB.open('battlecode-device',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('outbox',{keyPath:'id'});request.result.createObjectStore('drafts',{keyPath:'id'});};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
    request.onerror=()=>{opening=null;reject(request.error);};
    request.onblocked=()=>{opening=null;reject(new Error('Hãy đóng tab cũ để mở kho lưu trên thiết bị.'));};
  });
  return opening;
}
async function operation(table,method,value) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(table,method==='get'||method==='getAll'?'readonly':'readwrite');
    const request=transaction.objectStore(table)[method](value);
    transaction.oncomplete=()=>resolve(request.result);
    transaction.onabort=transaction.onerror=()=>reject(transaction.error||request.error||new Error('Không lưu được trên thiết bị.'));
  });
}
export const deviceStore={list:()=>operation('outbox','getAll'),put:entry=>operation('outbox','put',entry),remove:id=>operation('outbox','delete',id)};
export const readDraft=id=>operation('drafts','get',id);
export const writeDraft=entry=>operation('drafts','put',entry);
