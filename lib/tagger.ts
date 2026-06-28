/**
 * Tagger — converts raw arXiv category codes + title/abstract text into
 * precise, human-readable topic and organization tags.
 *
 * Returned tags are used as the Paper.tags JSON field and are filterable
 * via the `tag` query parameter in the papers API.
 */

// ---- arXiv category → human-readable label ----------------------------------

export const ARXIV_CATEGORY_LABELS: Record<string, string> = {
  "cs.AI": "Artificial Intelligence",
  "cs.LG": "Machine Learning",
  "cs.CL": "Natural Language Processing",
  "cs.CV": "Computer Vision",
  "cs.NE": "Neural & Evolutionary Computing",
  "cs.RO": "Robotics",
  "cs.IR": "Information Retrieval",
  "cs.HC": "Human-Computer Interaction",
  "cs.CR": "Cryptography & Security",
  "cs.SE": "Software Engineering",
  "cs.PL": "Programming Languages",
  "cs.MA": "Multi-Agent Systems",
  "cs.GT": "Game Theory",
  "cs.SY": "Systems & Control",
  "cs.DC": "Distributed Computing",
  "cs.DS": "Data Structures & Algorithms",
  "stat.ML": "Statistical Machine Learning",
  "stat.AP": "Applied Statistics",
  "eess.AS": "Audio & Speech Processing",
  "eess.IV": "Image & Video Processing",
  "eess.SP": "Signal Processing",
  "q-bio.NC": "Computational Neuroscience",
  "math.OC": "Optimization",
  "physics.comp-ph": "Computational Physics",
};

// ---- Topic detection (ordered most-specific first) --------------------------

const TOPIC_PATTERNS: Array<{ tag: string; re: RegExp }> = [
  {
    tag: "Large Language Models",
    re: /\b(large language model|LLMs?|GPT-[2-9]o?|Claude|Llama[\s-]?\d|Mistral|Gemini|Falcon|PaLM|Grok|Qwen|Yi-|Phi-|language model(?!ing))\b/i,
  },
  {
    tag: "Vision-Language Models",
    re: /\b(vision.language model|visual.language model|VLM|CLIP|DALL.E|Flamingo|LLaVA|BLIP|InstructBLIP|CogVLM|GPT-4V)\b/i,
  },
  {
    tag: "Diffusion Models",
    re: /\b(diffusion model|score.based generative|DDPM|DDIM|stable diffusion|latent diffusion|flow matching|denoising diffusion|rectified flow)\b/i,
  },
  {
    tag: "Transformers",
    re: /\b(transformer(s)?(?! station)|self.attention|multi.head attention|BERT|RoBERTa|ViT|vision transformer|attention is all)\b/i,
  },
  {
    tag: "Reinforcement Learning",
    re: /\b(reinforcement learning|RL(?!\w)|RLHF|reward model(?!ling)|policy gradient|Q.learning|PPO|DPO|GRPO|RLAIF|proximal policy)\b/i,
  },
  {
    tag: "AI Safety & Alignment",
    re: /\b(alignment|AI safety|constitutional AI|red.team|jailbreak|adversarial attack|harmful content|value alignment|model safety|toxicit|bias(?:ed|ness)?)\b/i,
  },
  {
    tag: "Reasoning & Planning",
    re: /\b(chain.of.thought|CoT(?!\w)|tree.of.thought|reasoning(?! about)|logical reasoning|mathematical reasoning|multi.step reasoning|planning(?! permission)|self.consistency)\b/i,
  },
  {
    tag: "AI Agents",
    re: /\b(autonomous agent|agentic|tool.use|tool.augmented|function calling|multi.agent system|LLM agent|agent framework|ReAct(?!\w))\b/i,
  },
  {
    tag: "Code Generation",
    re: /\b(code generation|program synthesis|CodeLLM|code model|coding assistant|code completion|code LLM|software engineering agent)\b/i,
  },
  {
    tag: "Efficient ML",
    re: /\b(quantization|model pruning|knowledge distillation|efficient inference|LoRA(?!\w)|PEFT|parameter.efficient|model compression|sparse(?:ity)?|low.rank adaptation)\b/i,
  },
  {
    tag: "RAG & Retrieval",
    re: /\b(retrieval.augmented generation|RAG(?!\w)|dense retrieval|document retrieval|retrieval.augmented|open.domain QA)\b/i,
  },
  {
    tag: "Image Generation",
    re: /\b(image generation|text.to.image|image synthesis|image editing|GAN(?!\w)|generative adversarial|inpainting|image.to.image)\b/i,
  },
  {
    tag: "Video Understanding",
    re: /\b(video understanding|video classification|temporal action|action recognition|video generation|video captioning|video.language)\b/i,
  },
  {
    tag: "3D Vision & NeRF",
    re: /\b(3D reconstruction|point cloud|depth estimation|NeRF(?!\w)|neural radiance field|gaussian splatting|3D generation|3D scene)\b/i,
  },
  {
    tag: "Object Detection",
    re: /\b(object detection|YOLO(?!\w)|bounding box|instance segmentation|anchor.free detection|DETR(?!\w)|panoptic)\b/i,
  },
  {
    tag: "Speech & Audio",
    re: /\b(speech recognition|automatic speech recognition|ASR(?!\w)|text.to.speech|TTS(?!\w)|audio generation|speech synthesis|Whisper(?!\w)|speaker diarization)\b/i,
  },
  {
    tag: "Graph Neural Networks",
    re: /\b(graph neural network|GNN(?!\w)|graph convolutional|graph attention|knowledge graph embedding|graph transformer)\b/i,
  },
  {
    tag: "Multimodal Learning",
    re: /\b(multimodal|multi.modal|cross.modal|image.text(?! detection)|audio.visual(?! speech))\b/i,
  },
  {
    tag: "Federated Learning",
    re: /\b(federated learning|federated optimization|federated aggregation|differential privacy)\b/i,
  },
  {
    tag: "Robotics & Embodied AI",
    re: /\b(robotic manipulation|robot learning|locomotion|embodied agent|sim.to.real|policy learning for robot|dexterous)\b/i,
  },
  {
    tag: "Medical AI",
    re: /\b(medical image(ing)?|clinical NLP|electronic health record|disease detection|radiology|patholog|biomedical text|clinical trial)\b/i,
  },
  {
    tag: "Foundation Models",
    re: /\b(foundation model|pre.?trained model|self.supervised learning|contrastive learning|masked language model|masked image)\b/i,
  },
  {
    tag: "In-Context Learning",
    re: /\b(in.context learning|few.shot prompting|zero.shot|instruction tuning|instruction following|prompt engineering|prompt tuning)\b/i,
  },
  {
    tag: "Neural Architecture Search",
    re: /\b(neural architecture search|NAS(?!\w)|AutoML|hyperparameter optimization|architecture design)\b/i,
  },
  {
    tag: "Interpretability & Explainability",
    re: /\b(interpretabilit|explainabilit|saliency map|attention visualization|concept activation|mechanistic interpretabilit|probing)\b/i,
  },
  {
    tag: "Tabular & Structured Data",
    re: /\b(tabular data|structured data|table understanding|table QA|spreadsheet)\b/i,
  },
  {
    tag: "Continual Learning",
    re: /\b(continual learning|lifelong learning|catastrophic forgetting|incremental learning)\b/i,
  },
  {
    tag: "Optimization",
    re: /\b(stochastic gradient|Adam(?!\w)|optimization algorithm|convergence analysis|loss landscape|second.order)\b/i,
  },
];

// ---- Organization detection -------------------------------------------------

export const ORGANIZATION_PATTERNS: Array<{ tag: string; re: RegExp }> = [
  { tag: "Anthropic", re: /\bAnthropic\b/ },
  { tag: "OpenAI", re: /\bOpenAI\b/ },
  { tag: "Google DeepMind", re: /\b(Google\s+)?DeepMind\b/ },
  { tag: "Google Research", re: /\bGoogle\s+(Research|Brain)\b/ },
  { tag: "Meta AI", re: /\b(Meta\s+AI|FAIR(?!\w)|Facebook\s+AI\s+Research|Meta\s+Reality\s+Labs)\b/ },
  { tag: "Microsoft Research", re: /\bMicrosoft\s+Research\b/ },
  { tag: "Hugging Face", re: /\bHugging\s*Face\b/i },
  { tag: "NVIDIA Research", re: /\bNVIDIA\s+Research\b/ },
  { tag: "Apple ML", re: /\b(Apple\s+Machine\s+Learning|Apple\s+Inc\.?\s+ML)\b/ },
  { tag: "Amazon Science", re: /\b(Amazon\s+Science|AWS\s+AI|Alexa\s+AI)\b/ },
  { tag: "Cohere", re: /\bCohere\b/ },
  { tag: "Mistral AI", re: /\bMistral\s+AI\b/ },
  { tag: "Stability AI", re: /\bStability\s+AI\b/ },
  { tag: "EleutherAI", re: /\bEleutherAI\b/ },
  { tag: "Allen AI", re: /\b(AllenAI|Allen\s+Institute\s+for\s+AI|AI2(?!\w))\b/ },
  { tag: "Salesforce Research", re: /\bSalesforce\s+Research\b/ },
  { tag: "IBM Research", re: /\bIBM\s+Research\b/ },
  { tag: "Samsung Research", re: /\bSamsung\s+Research\b/ },
  { tag: "Tencent AI", re: /\bTencent\s+(AI|Research)\b/i },
  { tag: "Baidu Research", re: /\bBaidu\s+Research\b/ },
];

// ---- Main export ------------------------------------------------------------

export interface TaggerInput {
  title: string;
  abstract?: string;
  rawCategories: string[]; // arXiv codes or conference names
}

export function normalizeTags(input: TaggerInput): string[] {
  const { title, abstract, rawCategories } = input;
  const text = `${title} ${abstract ?? ""}`;

  const tags = new Set<string>();

  // 1. Map arXiv category codes to human-readable labels
  for (const cat of rawCategories) {
    const label = ARXIV_CATEGORY_LABELS[cat];
    if (label) {
      tags.add(label);
    } else {
      // Keep unknown categories as-is (e.g. conference names from OpenReview)
      tags.add(cat);
    }
  }

  // 2. Detect topics from title + abstract
  for (const { tag, re } of TOPIC_PATTERNS) {
    if (re.test(text)) tags.add(tag);
  }

  // 3. Detect organizations from title + abstract
  for (const { tag, re } of ORGANIZATION_PATTERNS) {
    if (re.test(text)) tags.add(tag);
  }

  return [...tags];
}

/** All known organization tag names (for UI dropdowns) */
export const KNOWN_ORGANIZATIONS = ORGANIZATION_PATTERNS.map((o) => o.tag);

/** All known topic tag names (for UI dropdowns) */
export const KNOWN_TOPICS = TOPIC_PATTERNS.map((t) => t.tag);
