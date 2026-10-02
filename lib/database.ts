import { env } from 'cloudflare:workers';
import type { Store } from './pds-service';
export function database():Store {const db=(env as any).DB;if(!db)throw new Error('서버 저장소를 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');return db;}
