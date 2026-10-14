import { ApiError } from './api-errors';
export function optionalText(value: unknown): string | null {
  if (value===null || value===undefined || value==='') return null;
  if (typeof value!=='string' || value.length>8192) throw new ApiError('INVALID_INPUT','Invalid text value.');
  return value;
}
export async function jsonBody(request: Request): Promise<Record<string,unknown>> {
  if (!request.body) throw new ApiError('INVALID_INPUT','A JSON object is required.');
  const reader=request.body.getReader();
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    return await Promise.race([new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>{});reject(new ApiError('INVALID_INPUT','Request timed out.'));},5000);}),
      (async()=>{
        const chunks:Uint8Array[]=[];let size=0;
        while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
          if(size>64*1024)throw new ApiError('INVALID_INPUT','Request is too large.',413);chunks.push(part.value);}
        const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
        let value:unknown;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError('INVALID_INPUT','Invalid JSON.');}
        if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError('INVALID_INPUT','A JSON object is required.');
        return value as Record<string,unknown>;
      })()]);
  }finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
