import { create } from 'zustand';
import { aiApi } from '@/lib/api';

type JobStatus = 'processing' | 'done' | 'error';

interface ImageJob {
  productId: number;
  status: JobStatus;
  url?: string;
  error?: string;
}

interface ImageProcessingStore {
  jobs: Record<number, ImageJob>;
  runBgPrompt: (productId: number, prompt: string, apiKey: string) => void;
  consumeResult: (productId: number) => string | null;
  clearJob: (productId: number) => void;
}

export const useImageProcessing = create<ImageProcessingStore>((set, get) => ({
  jobs: {},

  runBgPrompt: (productId, prompt, apiKey) => {
    set(s => ({ jobs: { ...s.jobs, [productId]: { productId, status: 'processing' } } }));

    aiApi.processImage(apiKey, productId, 'prompt_bg', prompt)
      .then(res => {
        set(s => ({ jobs: { ...s.jobs, [productId]: { productId, status: 'done', url: res.url } } }));
      })
      .catch(e => {
        const error = e instanceof Error ? e.message : 'Error al procesar';
        set(s => ({ jobs: { ...s.jobs, [productId]: { productId, status: 'error', error } } }));
      });
  },

  consumeResult: (productId) => {
    const job = get().jobs[productId];
    if (job?.status === 'done' && job.url) {
      set(s => {
        const next = { ...s.jobs };
        delete next[productId];
        return { jobs: next };
      });
      return job.url;
    }
    return null;
  },

  clearJob: (productId) => {
    set(s => {
      const next = { ...s.jobs };
      delete next[productId];
      return { jobs: next };
    });
  },
}));
