// Model recommendations data - last refreshed 20Apr2025
const MODEL_RECOMMENDATIONS = {
    tiny: {                 // <5B params
        name: "<5B parameters",
        min_ram: 8,           // GB
        models: [
            {
                name: "Qwen3-0.6B",
                cpu: {
                    repo: "Qwen/Qwen3-0.6B-GGUF",
                    file: "qwen3-0.6b.Q4_K_M.gguf",
                    file_size_gb: 0.42,
                    ram_required: 2.0,
                    quant: "Q4_K_M"
                },
                gpu: {
                    repo: "Qwen/Qwen3-0.6B-AWQ",
                    ram_required: 1.5
                },
                params_b: 0.6,
                description: "Tiny Qwen3 model - great for resource-constrained devices."
            },
            {
                name: "Qwen3-1.7B",
                cpu: {
                    repo: "Qwen/Qwen3-1.7B-GGUF",
                    file: "qwen3-1.7b.Q4_K_M.gguf",
                    file_size_gb: 1.05,
                    ram_required: 3.5,
                    quant: "Q4_K_M"
                },
                gpu: {
                    repo: "Qwen/Qwen3-1.7B-AWQ",
                    ram_required: 2.5
                },
                params_b: 1.7,
                description: "Small but capable Qwen3 model with 32K context window."
            },
            {
                name: "Qwen3-4B",
                cpu: {
                    repo: "Qwen/Qwen3-4B-GGUF",
                    file: "qwen3-4b.Q4_K_M.gguf",
                    file_size_gb: 2.5,
                    ram_required: 5.0,
                    quant: "Q4_K_M"
                },
                gpu: {
                    repo: "Qwen/Qwen3-4B-AWQ",
                    ram_required: 4.0
                },
                params_b: 4,
                description: "Balanced Qwen3 model suitable for most laptops."
            }
        ]
    },

    small: {                // 5-10B
        name: "5-10B parameters",
        min_ram: 16,
        models: [
            {
                name: "Qwen3-8B",
                cpu: {
                    repo: "Qwen/Qwen3-8B-GGUF",
                    file: "qwen3-8b.Q4_K_M.gguf",
                    file_size_gb: 5.0,
                    ram_required: 8.0,
                    quant: "Q4_K_M"
                },
                gpu: {
                    repo: "Qwen/Qwen3-8B-AWQ",
                    ram_required: 6.0
                },
                params_b: 8,
                description: "Powerful Qwen3 model with 128K context window."
            },
            {
                name: "Qwen3-14B",
                cpu: {
                    repo: "Qwen/Qwen3-14B-GGUF",
                    file: "qwen3-14b.Q4_K_M.gguf",
                    file_size_gb: 8.0,
                    ram_required: 12.0,
                    quant: "Q4_K_M"
                },
                gpu: {
                    repo: "Qwen/Qwen3-14B-AWQ",
                    ram_required: 8.0
                },
                params_b: 14,
                description: "Strong Qwen3 model for complex tasks with 128K context."
            }
        ]
    },

    medium: {               // 10-20B
        name: "10-20B parameters",
        min_ram: 32,
        models: [
            {
                name: "Qwen3-32B",
                cpu: {
                    repo: "Qwen/Qwen3-32B-GGUF",
                    file: "qwen3-32b.Q4_K_M.gguf",
                    file_size_gb: 18.0,
                    ram_required: 24.0,
                    quant: "Q4_K_M"
                },
                gpu: {
                    repo: "Qwen/Qwen3-32B-AWQ",
                    ram_required: 14.0
                },
                params_b: 32,
                description: "Highly capable Qwen3 model with enhanced reasoning ability."
            }
        ]
    },

    large: {                // 20-35B
        name: "20-35B parameters",
        min_ram: 48,
        models: [
            {
                name: "Qwen3-30B-A3B (MoE)",
                cpu: {
                    repo: "Qwen/Qwen3-30B-A3B-GGUF",
                    file: "qwen3-30b-a3b.Q4_K_M.gguf",
                    file_size_gb: 20.0,
                    ram_required: 26.0,
                    quant: "Q4_K_M"
                },
                gpu: {
                    repo: "Qwen/Qwen3-30B-A3B-AWQ",
                    ram_required: 16.0
                },
                params_b: 30,
                description: "Powerful mixture-of-experts Qwen3 model with 3B active parameters."
            }
        ]
    },

    xlarge: {               // 35B+
        name: "35B+ parameters",
        min_ram: 64,
        models: [
            {
                name: "Qwen3-235B-A22B (MoE)",
                cpu: {
                    repo: "Qwen/Qwen3-235B-A22B-GGUF",
                    file: "qwen3-235b-a22b.Q4_K_M.gguf",
                    file_size_gb: 40.0,
                    ram_required: 50.0,
                    quant: "Q4_K_M"
                },
                gpu: {
                    repo: "Qwen/Qwen3-235B-A22B-AWQ",
                    ram_required: 28.0
                },
                params_b: 235,
                description: "Flagship Qwen3 MoE model with 22B active parameters, comparable to top closed-source models."
            }
        ]
    }
};

module.exports = {
    MODEL_RECOMMENDATIONS
}; 