// @vitest-environment node
import { describe,it,expect } from 'vitest';
import { POST } from './route';
describe('retired independent registration',()=>{
 it('does not create local password users or exchange registration keys for access',async()=>{
  const response=await POST();expect(response.status).toBe(410);expect((await response.json()).code).toBe('FORBIDDEN');
 });
});
