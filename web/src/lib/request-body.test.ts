import { describe,it,expect } from 'vitest';
import { jsonBody } from './request-body';

describe('bounded API input',()=>{
  it('rejects oversize JSON before parsing it',async()=>{
    const request=new Request('https://app.invalid/api/profile',{method:'POST',body:JSON.stringify({name:'x'.repeat(65536)})});
    await expect(jsonBody(request)).rejects.toMatchObject({status:413});
  });
  it('rejects invalid JSON and non-object values',async()=>{
    for(const body of ['{','null','[]']){
      await expect(jsonBody(new Request('https://app.invalid/api/profile',{method:'POST',body}))).rejects.toMatchObject({code:'INVALID_INPUT'});
    }
  });
});
