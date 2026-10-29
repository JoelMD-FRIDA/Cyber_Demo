import { mkdir, writeFile, realpath, lstat, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { withWriteLease } from '@/lib/db/postgres';
import { createDatabaseClient } from '@/lib/db/client';
import { ApiError } from '@/lib/api-errors';

export async function assetRoot() {
  const path = process.env.ASSET_DIRECTORY;
  if (!path || !path.startsWith('/')) throw new Error('Configure the persistent asset directory.');
  const root = resolve(path);
  if ((await lstat(root)).isSymbolicLink() || await realpath(root)!==root) throw new Error('Asset directory must not use symlinks.');
  return root;
}
export function validAssetPath(parts: string[]) {
  return parts.length===3 && ['providers','categories'].includes(parts[0]) &&
    /^[a-f0-9-]{36}$/.test(parts[1]) && /^[a-f0-9-]{36}\.png$/.test(parts[2]);
}
export async function uploadForm(request: Request) {
  if (!request.body) throw new ApiError('INVALID_INPUT','An image is required.');
  const reader=request.body.getReader();
  let timer:ReturnType<typeof setTimeout>|undefined;
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>{});reject(new ApiError('INVALID_INPUT','Upload timed out.'));},5000);});
  try {
    return await Promise.race([deadline,(async()=>{
      const chunks:Uint8Array[]=[];let total=0;
      while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;
        if(total>3*1024*1024)throw new ApiError('INVALID_INPUT','Upload is too large.');chunks.push(part.value);}
      const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      return new Response(bytes,{headers:{'content-type':request.headers.get('content-type')??''}}).formData();
    })()]);
  } finally {clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
export async function saveAsset(file: File, kind: 'providers'|'categories', id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id) || file.size<1 || file.size>2*1024*1024)
    throw new ApiError('INVALID_INPUT','A PNG, JPEG or WebP image smaller than 2 MB is required.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  const webp = bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP';
  if (!png && !jpeg && !webp) throw new ApiError('INVALID_INPUT','Only PNG, JPEG and WebP images are supported.');
  const normalized = await sharp(bytes,{ limitInputPixels:16_000_000,animated:false }).rotate().png().toBuffer();
  if (normalized.length>4*1024*1024) throw new ApiError('INVALID_INPUT','The normalized image is too large.');
  return withWriteLease(async connection => {
    const root = await assetRoot();
    const directory = join(root,kind,id);
    await mkdir(directory,{ recursive:true,mode:0o700 });
    if (await realpath(directory)!==directory) throw new Error('Asset path contains a symlink.');
    const name = randomUUID()+'.png';
    await writeFile(join(directory,name),normalized,{ flag:'wx',mode:0o600 });
    const path = `/api/assets/${kind}/${id}/${name}`;
    const table = kind==='providers' ? 'domain_check_providers' : 'domain_check_categories';
    const result = await createDatabaseClient(connection).from(table).update({ asset_path:path }).eq('id',id).single();
    if (result.error || !result.data) throw new Error('Asset catalog update failed.');
    return path;
  });
}
export async function loadAsset(parts: string[]) {
  if (!validAssetPath(parts)) throw new ApiError('NOT_FOUND','Image not found.',404);
  const root = await assetRoot(), path = join(root,...parts);
  if (await realpath(path)!==path || (await lstat(path)).isSymbolicLink()) throw new ApiError('NOT_FOUND','Image not found.',404);
  return readFile(path);
}
