export function envelope(state,now=new Date()){
  const clean=JSON.parse(JSON.stringify({...state,effects:[]}));
  return {format:'lantern-gate-save',schema:1,savedAt:now.toISOString(),character:clean.player.name||'The Wayfarer',state:clean};
}
export function decodeSave(text,validate){
  if(typeof text!=='string'||text.length>2000000)throw Error('Choose a save smaller than 2 MB.');
  const data=JSON.parse(text),state=data.format==='lantern-gate-save'?data.state:data;
  if(data.format==='lantern-gate-save'&&data.schema!==1)throw Error('This save uses a newer unsupported format.');
  if(!validate(state))throw Error('This is not a compatible Lantern Gate save.');return state;
}
export class NetworkSaves{
  constructor({getState,validate,onStatus,picker=globalThis.showDirectoryPicker}){Object.assign(this,{getState,validate,onStatus,picker:typeof picker==='function'&&picker===globalThis.showDirectoryPicker?picker.bind(globalThis):picker});this.directory=null;this.busy=false;this.pending=false;this.auto=false;this.status='Choose a shared folder or network drive.';}
  report(message){this.status=message;this.onStatus?.(message);}
  async choose(){
    if(!this.picker)throw Error('Folder access is unavailable in this browser. Open the game separately in Chrome or Edge, or export a save to your shared folder.');
    const directory=await this.picker({id:'lantern-gate-network',mode:'readwrite'});this.directory=directory;this.report('Connected to '+directory.name+'. Save a copy to this folder.');return directory.name;
  }
  async write(){
    if(!this.directory)throw Error('Choose a shared folder first.');
    if(this.busy){this.pending=true;return false;}this.busy=true;const directory=this.directory;
    try{
      const s=this.getState();if(!this.validate(s))throw Error('The current journey could not be validated. Your browser save remains available.');
      const profileValue=s.flags.saveProfile??globalThis.crypto?.randomUUID?.()??('journey-'+Date.now().toString(16));
      const profile=String(profileValue).replace(/[^a-zA-Z0-9-]/g,'').slice(0,64);if(!profile)throw Error('The save profile is invalid.');
      // Freeze the selected character and destination for this transaction.
      // A queued request takes its own newer snapshot after this one finishes.
      const snapshot=envelope(s);snapshot.state.flags.saveProfile??=profileValue;
      const content=JSON.stringify(snapshot);if(content.length>2000000)throw Error('The current journey exceeds the compatible save size.');
      if(directory.queryPermission&&await directory.queryPermission({mode:'readwrite'})!=='granted')throw Error('Folder access expired. Choose the folder again to reconnect.');
      s.flags.saveProfile??=profileValue;
      const file=await directory.getFileHandle('lantern-gate-'+profile+'.json',{create:true});
      // Preserve the previous compatible snapshot before replacing the current file.
      const prior=await file.getFile();if(prior.size){if(prior.size>2000000)throw Error('An unrelated or oversized file occupies this save slot.');const text=await prior.text();decodeSave(text,this.validate);const backup=await directory.getFileHandle('lantern-gate-'+profile+'-previous.json',{create:true}),writer=await backup.createWritable();try{await writer.write(text);await writer.close();}catch(e){await writer.abort?.();throw e;}}
      const writer=await file.createWritable();try{await writer.write(content);await writer.close();}catch(e){await writer.abort?.();throw e;}
      this.report('Shared-folder save written at '+new Date().toLocaleTimeString()+'.');return true;
    }catch(e){this.report('Shared-folder save failed. Your browser save is retained. '+e.message);throw e;}
    finally{this.busy=false;if(this.pending){this.pending=false;queueMicrotask(()=>this.write().catch(()=>{}));}}
  }
  async load(){
    if(!this.directory)throw Error('Choose a shared folder first.');const files=[];
    for await(const [name,handle]of this.directory.entries())if(handle.kind==='file'&&/^lantern-gate-[a-zA-Z0-9-]+\.json$/.test(name)){const file=await handle.getFile();if(file.size>2000000)continue;try{const state=decodeSave(await file.text(),this.validate);files.push({name,state,time:file.lastModified});}catch{}}
    return files.sort((a,b)=>b.time-a.time);
  }
}
