// Model recommendations data - last refreshed November 2024
const MODEL_RECOMMENDATIONS = {
    tiny: {                 // <5B params
        name: "<5B parameters",
        min_ram: 8,           // GB
        models: [
            {
                name: "Llama-3.2-1B-Instruct",
                cpu: {
                    repo: "Mozilla/Llama-3.2-1B-Instruct-llamafile",
                    file: "Llama-3.2-1B-Instruct.Q4_0.llamafile",
                    file_size_gb: 0.62,
                    ram_required: 2.0,
                    quant: "Q4_0"
                },
                gpu: {
                    repo: "Mozilla/Llama-3.2-1B-Instruct-llamafile",
                    ram_required: 1.5
                },
                params_b: 1,
                description: "Small Meta Llama 3.2 model, runs on most devices with minimal requirements."
            },
            {
                name: "Qwen2.5-0.5B-Instruct",
                cpu: {
                    repo: "Mozilla/Qwen2.5-0.5B-Instruct-llamafile",
                    file: "Qwen2.5-0.5B-Instruct.Q5_K_M.llamafile",
                    file_size_gb: 0.4,
                    ram_required: 1.5,
                    quant: "Q5_K_M"
                },
                gpu: {
                    repo: "Mozilla/Qwen2.5-0.5B-Instruct-llamafile",
                    ram_required: 1.0
                },
                params_b: 0.5,
                description: "Tiny but capable Qwen2.5 model in llamafile format."
            }
        ]
    },

    small: {                // 5-10B
        name: "5-10B parameters",
        min_ram: 16,
        models: [
            {
                name: "Meta-Llama-3-8B-Instruct",
                cpu: {
                    repo: "Mozilla/Meta-Llama-3-8B-Instruct-llamafile",
                    file: "Meta-Llama-3-8B-Instruct.Q4_0.llamafile",
                    file_size_gb: 4.3,
                    ram_required: 8.0,
                    quant: "Q4_0"
                },
                gpu: {
                    repo: "Mozilla/Meta-Llama-3-8B-Instruct-llamafile",
                    ram_required: 6.0
                },
                params_b: 8,
                description: "High-performance Meta Llama 3 model with 8K context window."
            },
            {
                name: "Meta-Llama-3.1-8B",
                cpu: {
                    repo: "Mozilla/Meta-Llama-3.1-8B-llamafile",
                    file: "Meta-Llama-3.1-8B.Q6_K.llamafile",
                    file_size_gb: 5.2,
                    ram_required: 9.0,
                    quant: "Q6_K"
                },
                gpu: {
                    repo: "Mozilla/Meta-Llama-3.1-8B-llamafile",
                    ram_required: 7.0
                },
                params_b: 8,
                description: "Multilingual Meta Llama 3.1 model with 128K context window."
            },
            {
                name: "OLMo-7B",
                cpu: {
                    repo: "Mozilla/OLMo-7B-0424-llamafile",
                    file: "OLMo-7B-0424.f16.llamafile",
                    file_size_gb: 12.8,
                    ram_required: 14.0,
                    quant: "F16"
                },
                gpu: {
                    repo: "Mozilla/OLMo-7B-0424-llamafile",
                    ram_required: 12.0
                },
                params_b: 7,
                description: "The Allen Institute's open language model in f16 precision."
            }
        ]
    },

    multimodal: {               // Vision-capable models
        name: "Multimodal Models",
        min_ram: 16,
        models: [
            {
                name: "LLaVA v1.5 7B",
                cpu: {
                    repo: "Mozilla/llava-v1.5-7b-llamafile",
                    file: "llava-v1.5-7b-q4.llamafile",
                    file_size_gb: 4.57,
                    ram_required: 8.0,
                    quant: "Q4"
                },
                gpu: {
                    repo: "Mozilla/llava-v1.5-7b-llamafile",
                    ram_required: 6.0
                },
                params_b: 7,
                description: "Vision-language model capable of understanding images and text."
            },
            {
                name: "LLaVA v1.6 Mistral 7B",
                cpu: {
                    repo: "Mozilla/llava-v1.5-7b-llamafile",
                    file: "llava-v1.6-mistral-7b.Q8_0.llamafile",
                    file_size_gb: 8.34,
                    ram_required: 10.0,
                    quant: "Q8_0"
                },
                gpu: {
                    repo: "Mozilla/llava-v1.5-7b-llamafile",
                    ram_required: 8.0
                },
                params_b: 7,
                description: "Improved vision-language model based on Mistral 7B."
            }
        ]
    },

    embeddings: {               // Embedding models
        name: "Embedding Models",
        min_ram: 16,
        models: [
            {
                name: "mxbai-embed-large-v1",
                cpu: {
                    repo: "Mozilla/mxbai-embed-large-v1-llamafile",
                    file: "mxbai-embed-large-v1-f16.llamafile",
                    file_size_gb: 0.7,
                    ram_required: 2.0,
                    quant: "F16"
                },
                gpu: {
                    repo: "Mozilla/mxbai-embed-large-v1-llamafile",
                    ram_required: 1.5
                },
                params_b: 0.8,
                description: "High-quality text embedding model for search and retrieval."
            }
        ]
    },

    audio: {               // Audio models
        name: "Audio Models",
        min_ram: 16,
        models: [
            {
                name: "Whisper",
                cpu: {
                    repo: "Mozilla/whisperfile",
                    file: "whisper-small-q5_0.llamafile",
                    file_size_gb: 0.5,
                    ram_required: 2.0,
                    quant: "Q5_0"
                },
                gpu: {
                    repo: "Mozilla/whisperfile",
                    ram_required: 1.5
                },
                params_b: 0.5,
                description: "Speech recognition model capable of transcribing spoken language."
            }
        ]
    }
};

module.exports = {
    MODEL_RECOMMENDATIONS
}; 