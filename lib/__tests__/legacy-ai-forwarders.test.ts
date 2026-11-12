/** @jest-environment node */
import { NextRequest } from 'next/server'
let mockUser: {id:string}|null
let mockRole: string
let mockSession: {access_token:string}|null
const mockInsert = jest.fn()
jest.mock('@supabase/ssr',()=>({createServerClient:()=>({auth:{getSession:async()=>({data:{session:mockSession}}),getUser:async()=>({data:{user:mockUser}})}})}))
jest.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:mockUser},error:null})}})}))
jest.mock('@/lib/security',()=>({userClient:()=>({
 from:(table:string)=>table==='profiles'?{select:()=>({eq:()=>({single:async()=>({data:{role:mockRole}})})})}:{insert:mockInsert},
 storage:{from:()=>({upload:async()=>({error:null})})}
})}))
jest.mock('pdf-lib',()=>({PDFDocument:{load:async()=>({getForm:()=>({getFields:()=>[{getName:()=> 'Buyer',constructor:{name:'PDFTextField'}}]})})}}))
import { POST as chat } from '@/app/api/ai/chat/route'
import { POST as closeiq } from '@/app/api/closeiq/ai/route'
import { POST as templates } from '@/app/api/closeiq/templates/route'
import { VAULT_API_URL } from '@/lib/vault-client'
function request(body:unknown,token='Bearer caller') {
 return new NextRequest('http://localhost/api',{method:'POST',headers:{authorization:token},body:JSON.stringify(body)})
}
function upload(token='Bearer caller') {
 const req=request({},token)
 const values:Record<string,unknown>={file:{name:'offer.pdf',arrayBuffer:async()=>new ArrayBuffer(2)},name:'Offer',slug:'offer'}
 req.formData=jest.fn(async()=>({get:(key:string)=>values[key]??null})) as any
 return req
}
beforeEach(()=>{
 jest.clearAllMocks();mockUser={id:'user'};mockRole='broker';mockSession=null;
 global.fetch=jest.fn(async()=>new Response(JSON.stringify({buyer_name:'Buyer'}),{status:200})) as any
 mockInsert.mockReturnValue({select:()=>({single:async()=>({data:{id:'template'},error:null})})})
})
describe.each([
 ['chat',chat,{message:'hi'},'/ai/legacy/chat'],
 ['closeiq',closeiq,{action:'parse_voice',transcript:'cash'},'/ai/legacy/closeiq'],
] as const)('%s forwarder',(_name,route,body,path)=>{
 it('forwards caller token and exact body and returns Vault JSON',async()=>{
  const res=await route(request(body));expect(res.status).toBe(200);expect(await res.json()).toEqual({buyer_name:'Buyer'})
  expect(fetch).toHaveBeenCalledWith(VAULT_API_URL+path,expect.objectContaining({method:'POST',headers:expect.objectContaining({Authorization:'Bearer caller'}),body:JSON.stringify(body)}))
 })
 it('passes Vault 503 and its error shape unchanged',async()=>{
  ;(fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({error:'unavailable'}),{status:503}))
  const res=await route(request(body));expect(res.status).toBe(503);expect(await res.json()).toEqual({error:'unavailable'})
 })
 it('returns unauthenticated without contacting Vault',async()=>{
  const res=await route(request(body,''));expect(res.status).toBe(401);expect(fetch).not.toHaveBeenCalled()
 })
 it('forwards a portal cookie session as Bearer',async()=>{
  mockSession={access_token:'cookie-token'};await route(request(body,''))
  expect(fetch).toHaveBeenCalledWith(VAULT_API_URL+path,expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer cookie-token'})}))
 })
})
describe('template mapping forwarder inside upload',()=>{
 it('keeps upload response and persists suggested mapping from Vault',async()=>{
  const res=await templates(upload());expect(res.status).toBe(200);expect((await res.json()).suggested_mapping).toEqual({buyer_name:'Buyer'})
  expect(fetch).toHaveBeenCalledWith(VAULT_API_URL+'/ai/legacy/template-mapping',expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer caller'}),body:expect.any(String)}))
  const body=JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)
  expect(body.pdfFieldNames).toEqual(['Buyer']);expect(body.offerDataKeys).toContain('buyer_name')
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({field_mapping:{buyer_name:'Buyer'}}))
 })
 it('preserves optional mapping fallback when Vault is 503',async()=>{
  ;(fetch as jest.Mock).mockResolvedValue(new Response('{}',{status:503}))
  const res=await templates(upload());expect(res.status).toBe(200);expect((await res.json()).suggested_mapping).toEqual({})
 })
 it('rejects unauthenticated upload',async()=>{
  mockUser=null;expect((await templates(upload(''))).status).toBe(401);expect(fetch).not.toHaveBeenCalled();expect(mockInsert).not.toHaveBeenCalled()
 })
 it('rejects denied role before upload or AI',async()=>{
  mockRole='admin';expect((await templates(upload())).status).toBe(403);expect(fetch).not.toHaveBeenCalled();expect(mockInsert).not.toHaveBeenCalled()
 })
})
