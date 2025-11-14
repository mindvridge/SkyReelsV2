"""SkyReels V2 video generation service - Official API Integration"""

import sys
import torch
import logging
from pathlib import Path
from typing import Optional, Literal
from diffusers import (
    AutoModel,
    SkyReelsV2DiffusionForcingPipeline,
    SkyReelsV2DiffusionForcingImageToVideoPipeline,
    UniPCMultistepScheduler,
)
from diffusers.utils import export_to_video, load_image
import cv2

logger = logging.getLogger(__name__)

# MPS (Apple Silicon) 호환성을 위한 패치
# MPS는 float64를 지원하지 않으므로 float32로 자동 변환
# 이 패치는 모듈이 import될 때 즉시 적용됩니다
if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
    # diffusers의 embeddings 모듈에서 float64를 float32로 변환하는 패치
    try:
        # 이미 import된 관련 모듈들을 삭제하고 다시 로드
        modules_to_reload = [
            'diffusers.models.embeddings',
            'diffusers.models.transformers.transformer_skyreels_v2',
            'diffusers.models.transformers',
        ]
        
        for module_name in modules_to_reload:
            if module_name in sys.modules:
                del sys.modules[module_name]
        
        # diffusers.models.embeddings를 직접 import하여 패치
        import diffusers.models.embeddings as embeddings_module
        
        # 원본 함수 저장
        _original_get_1d_sincos_pos_embed_from_grid = embeddings_module.get_1d_sincos_pos_embed_from_grid
        
        def _patched_get_1d_sincos_pos_embed_from_grid(embed_dim, pos, output_type="pt", flip_sin_to_cos=False):
            """MPS 호환성을 위해 float64를 float32로 변환"""
            # output_type이 "np"이면 원본 함수 호출 (deprecated 경로)
            if output_type == "np":
                return _original_get_1d_sincos_pos_embed_from_grid(embed_dim, pos, output_type="np", flip_sin_to_cos=flip_sin_to_cos)
            
            # embed_dim 검증
            if embed_dim % 2 != 0:
                raise ValueError("embed_dim must be divisible by 2")
            
            # pos가 MPS device에 있으면 float32로 변환
            if hasattr(pos, 'device') and pos.device.type == "mps":
                pos = pos.float()
            
            # float64 대신 float32 사용 (MPS 호환성)
            omega = torch.arange(embed_dim // 2, device=pos.device, dtype=torch.float32)
            omega /= embed_dim / 2.0
            omega = 1.0 / (10000 ** omega)  # (D/2,)
            
            pos = pos.reshape(-1)  # (M,)
            out = torch.outer(pos, omega)  # (M, D/2), outer product
            
            emb_sin = torch.sin(out)  # (M, D/2)
            emb_cos = torch.cos(out)  # (M, D/2)
            
            emb = torch.concat([emb_sin, emb_cos], dim=1)  # (M, D)
            
            # flip sine and cosine embeddings
            if flip_sin_to_cos:
                emb = torch.cat([emb[:, embed_dim // 2 :], emb[:, : embed_dim // 2]], dim=1)
            
            return emb
        
        # 함수 패치 적용 (모듈 레벨에서 직접 교체)
        embeddings_module.get_1d_sincos_pos_embed_from_grid = _patched_get_1d_sincos_pos_embed_from_grid
        
        # sys.modules에서도 업데이트 (다른 곳에서 이미 import한 경우 대비)
        if 'diffusers.models.embeddings' in sys.modules:
            sys.modules['diffusers.models.embeddings'].get_1d_sincos_pos_embed_from_grid = _patched_get_1d_sincos_pos_embed_from_grid
        
        # diffusers.models 모듈에서도 업데이트
        if 'diffusers.models' in sys.modules:
            if hasattr(sys.modules['diffusers.models'], 'embeddings'):
                sys.modules['diffusers.models'].embeddings.get_1d_sincos_pos_embed_from_grid = _patched_get_1d_sincos_pos_embed_from_grid
        
        # diffusers.models.transformers 모듈에서도 업데이트
        # transformer_skyreels_v2 모듈이 이미 import한 함수 참조를 업데이트
        try:
            import importlib
            # transformer 모듈을 강제로 다시 로드
            if 'diffusers.models.transformers.transformer_skyreels_v2' in sys.modules:
                importlib.reload(sys.modules['diffusers.models.transformers.transformer_skyreels_v2'])
            
            # transformer 모듈을 import하고 내부의 함수 참조 업데이트
            import diffusers.models.transformers.transformer_skyreels_v2 as transformer_module
            # 모듈 내부에서 직접 import한 경우를 대비하여 모듈의 __dict__를 확인
            for attr_name in dir(transformer_module):
                attr = getattr(transformer_module, attr_name)
                # 함수가 get_1d_sincos_pos_embed_from_grid를 참조하는 경우 업데이트
                if callable(attr) and hasattr(attr, '__globals__'):
                    try:
                        if 'get_1d_sincos_pos_embed_from_grid' in attr.__globals__:
                            attr.__globals__['get_1d_sincos_pos_embed_from_grid'] = _patched_get_1d_sincos_pos_embed_from_grid
                    except:
                        pass
        except Exception as transformer_error:
            logger.warning(f"Transformer 모듈 패치 중 오류 (계속 진행): {transformer_error}")
        
        logger.info("✅ MPS 호환성 패치 적용됨 (float64 -> float32 변환)")
        
        # scaled_dot_product_attention을 MPS에서 CPU로 fallback하도록 패치
        try:
            import torch.nn.functional as F
            
            # 원본 함수 저장
            _original_scaled_dot_product_attention = F.scaled_dot_product_attention
            
            def _patched_scaled_dot_product_attention(query, key, value, attn_mask=None, dropout_p=0.0, is_causal=False, scale=None):
                """MPS에서 큰 버퍼 크기 문제를 피하기 위해 CPU로 fallback"""
                # MPS device인 경우
                if query.device.type == "mps":
                    # 텐서 크기를 미리 체크하여 큰 경우 바로 CPU로 fallback (메모리 오류 방지)
                    # query@key^T 연산 시 필요한 메모리: query.size(-2) * key.size(-2) * element_size
                    # MPS 버퍼 크기 제한은 약 2GB이지만, 안전을 위해 1GB로 제한
                    try:
                        query_size = query.numel() * query.element_size()
                        key_size = key.numel() * key.element_size()
                        value_size = value.numel() * value.element_size()
                        total_size = query_size + key_size + value_size
                        
                        # 예상 attention 행렬 크기: query.size(-2) * key.size(-2) * element_size
                        if query.dim() >= 2 and key.dim() >= 2:
                            attention_matrix_size = query.size(-2) * key.size(-2) * query.element_size()
                            # 500MB 이상이면 미리 CPU로 fallback (MPS 버퍼 제한 회피)
                            if attention_matrix_size > 500 * 1024 * 1024:  # 500MB
                                logger.debug(f"MPS: 큰 attention 행렬 감지 ({attention_matrix_size / (1024**2):.2f}MB), CPU로 사전 fallback")
                                # 바로 CPU로 fallback
                                query_cpu = query.cpu()
                                key_cpu = key.cpu()
                                value_cpu = value.cpu()
                                attn_mask_cpu = attn_mask.cpu() if attn_mask is not None else None
                                
                                if scale is not None:
                                    result_cpu = _original_scaled_dot_product_attention(
                                        query_cpu, key_cpu, value_cpu, attn_mask=attn_mask_cpu, dropout_p=dropout_p, is_causal=is_causal, scale=scale
                                    )
                                else:
                                    result_cpu = _original_scaled_dot_product_attention(
                                        query_cpu, key_cpu, value_cpu, attn_mask=attn_mask_cpu, dropout_p=dropout_p, is_causal=is_causal
                                    )
                                
                                return result_cpu.to(query.device)
                    except Exception as size_check_error:
                        # 크기 체크 실패 시 무시하고 계속 진행
                        logger.debug(f"텐서 크기 체크 실패: {size_check_error}")
                    
                    # 크기가 작거나 체크 실패 시 MPS에서 시도
                    try:
                        # 먼저 MPS에서 시도
                        # scale 파라미터를 명시적으로 keyword argument로 전달
                        if scale is not None:
                            return _original_scaled_dot_product_attention(
                                query, key, value, attn_mask=attn_mask, dropout_p=dropout_p, is_causal=is_causal, scale=scale
                            )
                        else:
                            return _original_scaled_dot_product_attention(
                                query, key, value, attn_mask=attn_mask, dropout_p=dropout_p, is_causal=is_causal
                            )
                    except RuntimeError as e:
                        if "Invalid buffer size" in str(e) or "buffer size" in str(e).lower():
                            # 큰 버퍼 크기 오류인 경우 CPU로 fallback
                            logger.warning(f"⚠️  MPS에서 큰 버퍼 크기 오류 발생, CPU로 fallback: {e}")
                            
                            # CPU로 이동하여 계산
                            query_cpu = query.cpu()
                            key_cpu = key.cpu()
                            value_cpu = value.cpu()
                            attn_mask_cpu = attn_mask.cpu() if attn_mask is not None else None
                            
                            # CPU에서 계산
                            if scale is not None:
                                result_cpu = _original_scaled_dot_product_attention(
                                    query_cpu, key_cpu, value_cpu, attn_mask=attn_mask_cpu, dropout_p=dropout_p, is_causal=is_causal, scale=scale
                                )
                            else:
                                result_cpu = _original_scaled_dot_product_attention(
                                    query_cpu, key_cpu, value_cpu, attn_mask=attn_mask_cpu, dropout_p=dropout_p, is_causal=is_causal
                                )
                            
                            # 다시 MPS로 이동
                            return result_cpu.to(query.device)
                        else:
                            # 다른 오류는 그대로 전파
                            raise
                else:
                    # MPS가 아니면 원본 함수 사용
                    if scale is not None:
                        return _original_scaled_dot_product_attention(
                            query, key, value, attn_mask=attn_mask, dropout_p=dropout_p, is_causal=is_causal, scale=scale
                        )
                    else:
                        return _original_scaled_dot_product_attention(
                            query, key, value, attn_mask=attn_mask, dropout_p=dropout_p, is_causal=is_causal
                        )
            
            # 함수 패치 적용
            F.scaled_dot_product_attention = _patched_scaled_dot_product_attention
            
            # diffusers의 transformer 모듈에서도 업데이트
            try:
                import diffusers.models.transformers.transformer_skyreels_v2 as transformer_module
                if hasattr(transformer_module, 'F'):
                    transformer_module.F.scaled_dot_product_attention = _patched_scaled_dot_product_attention
                
                # 모듈 내부에서 직접 import한 경우를 대비
                for attr_name in dir(transformer_module):
                    attr = getattr(transformer_module, attr_name)
                    if callable(attr) and hasattr(attr, '__globals__'):
                        try:
                            if 'scaled_dot_product_attention' in attr.__globals__:
                                attr.__globals__['scaled_dot_product_attention'] = _patched_scaled_dot_product_attention
                        except:
                            pass
            except Exception as transformer_error:
                logger.warning(f"Transformer 모듈 scaled_dot_product_attention 패치 중 오류 (계속 진행): {transformer_error}")
            
            logger.info("✅ scaled_dot_product_attention MPS->CPU fallback 패치 적용됨")
        except Exception as e:
            logger.warning(f"⚠️  scaled_dot_product_attention 패치 적용 실패: {e}")
            import traceback
            logger.warning(traceback.format_exc())
    except Exception as e:
        logger.warning(f"⚠️  MPS 호환성 패치 적용 실패: {e}")
        import traceback
        logger.warning(traceback.format_exc())


class SkyReelsGenerator:
    """
    SkyReels V2 video generation service using official Diffusers API
    Supports Text-to-Video (T2V), Image-to-Video (I2V), and Diffusion Forcing (DF) modes
    Supports both 14B and 1.3B model sizes
    """

    def __init__(
        self,
        model_type: Literal["t2v", "i2v", "df"],
        resolution: Literal["540P", "720P"],
        model_size: Literal["1.3B", "14B"] = "14B",
        model_cache_dir: str = "/models"
    ):
        """
        Initialize the SkyReels generator

        Args:
            model_type: One of 't2v', 'i2v', or 'df'
            resolution: One of '540P' or '720P'
            model_size: One of '1.3B' or '14B' (default: '14B')
            model_cache_dir: Directory for caching models
        """
        self.model_type = model_type.lower()
        self.resolution = resolution
        self.model_size = model_size
        self.model_cache_dir = model_cache_dir
        self.pipeline = None
        
        # Device detection: CUDA > MPS > CPU
        # Note: Docker 컨테이너 내부에서는 MPS를 사용할 수 없으므로 CPU만 사용됩니다
        if torch.cuda.is_available():
            self.device = "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            self.device = "mps"  # Apple Silicon GPU (Docker에서는 사용 불가)
        else:
            self.device = "cpu"  # macOS Docker에서는 CPU만 사용 (시스템 RAM 사용)

        logger.info(
            f"Initializing SkyReels generator: "
            f"type={model_type}, size={model_size}, res={resolution}, device={self.device}"
        )
        
        if self.device == "mps":
            logger.info(
                "✅ MPS (Metal Performance Shaders) 모드로 실행 중입니다. "
                "Apple Silicon GPU를 사용하여 빠른 성능을 제공합니다."
            )
        elif self.device == "cpu":
            logger.warning(
                "⚠️  CPU 모드로 실행 중입니다. "
                "Docker 컨테이너 내부에서는 macOS GPU(Metal)를 사용할 수 없으므로 "
                "시스템 RAM을 사용하며 매우 느립니다. "
                "로컬에서 실행하면 MPS를 사용할 수 있습니다."
        )

        # Model mapping: {model_type: {model_size: {resolution: model_id}}}
        self.model_mapping = {
            "t2v": {
                "14B": {
                    "540P": "Skywork/SkyReels-V2-DF-14B-540P-Diffusers",
                    "720P": "Skywork/SkyReels-V2-DF-14B-720P-Diffusers",
                },
                "1.3B": {
                    "540P": "Skywork/SkyReels-V2-DF-1.3B-540P-Diffusers",
                    # 1.3B 720P is not available, fallback to 540P
                    "720P": "Skywork/SkyReels-V2-DF-1.3B-540P-Diffusers",
                },
            },
            "i2v": {
                "14B": {
                    "540P": "Skywork/SkyReels-V2-I2V-14B-540P-Diffusers",
                    "720P": "Skywork/SkyReels-V2-I2V-14B-720P-Diffusers",
                },
                "1.3B": {
                    "540P": "Skywork/SkyReels-V2-I2V-1.3B-540P-Diffusers",
                    "720P": "Skywork/SkyReels-V2-I2V-1.3B-540P-Diffusers",  # Fallback
                },
            },
            "df": {
                "14B": {
                    "540P": "Skywork/SkyReels-V2-DF-14B-540P-Diffusers",
                    "720P": "Skywork/SkyReels-V2-DF-14B-720P-Diffusers",
                },
                "1.3B": {
                    "540P": "Skywork/SkyReels-V2-DF-1.3B-540P-Diffusers",
                    "720P": "Skywork/SkyReels-V2-DF-1.3B-540P-Diffusers",  # Fallback
                },
            },
        }

        # Load the appropriate pipeline
        self._load_pipeline()

    def _load_pipeline(self):
        """Load the appropriate Diffusers pipeline based on model configuration"""
        try:
            # MPS 호환성 패치를 pipeline 로드 전에 다시 적용
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                try:
                    import importlib
                    # 이미 import된 관련 모듈들을 삭제하고 다시 로드
                    modules_to_reload = [
                        'diffusers.models.embeddings',
                        'diffusers.models.transformers.transformer_skyreels_v2',
                        'diffusers.models.transformers',
                    ]
                    
                    for module_name in modules_to_reload:
                        if module_name in sys.modules:
                            del sys.modules[module_name]
                    
                    # diffusers.models.embeddings를 직접 import하여 패치
                    import diffusers.models.embeddings as embeddings_module
                    
                    # 원본 함수 저장
                    _original_get_1d_sincos_pos_embed_from_grid = embeddings_module.get_1d_sincos_pos_embed_from_grid
                    
                    def _patched_get_1d_sincos_pos_embed_from_grid(embed_dim, pos, output_type="pt", flip_sin_to_cos=False):
                        """MPS 호환성을 위해 float64를 float32로 변환"""
                        if output_type == "np":
                            return _original_get_1d_sincos_pos_embed_from_grid(embed_dim, pos, output_type="np", flip_sin_to_cos=flip_sin_to_cos)
                        
                        if embed_dim % 2 != 0:
                            raise ValueError("embed_dim must be divisible by 2")
                        
                        if hasattr(pos, 'device') and pos.device.type == "mps":
                            pos = pos.float()
                        
                        omega = torch.arange(embed_dim // 2, device=pos.device, dtype=torch.float32)
                        omega /= embed_dim / 2.0
                        omega = 1.0 / (10000 ** omega)
                        
                        pos = pos.reshape(-1)
                        out = torch.outer(pos, omega)
                        
                        emb_sin = torch.sin(out)
                        emb_cos = torch.cos(out)
                        
                        emb = torch.concat([emb_sin, emb_cos], dim=1)
                        
                        if flip_sin_to_cos:
                            emb = torch.cat([emb[:, embed_dim // 2 :], emb[:, : embed_dim // 2]], dim=1)
                        
                        return emb
                    
                    # 함수 패치 적용
                    embeddings_module.get_1d_sincos_pos_embed_from_grid = _patched_get_1d_sincos_pos_embed_from_grid
                    
                    # sys.modules에서도 업데이트
                    if 'diffusers.models.embeddings' in sys.modules:
                        sys.modules['diffusers.models.embeddings'].get_1d_sincos_pos_embed_from_grid = _patched_get_1d_sincos_pos_embed_from_grid
                    
                    if 'diffusers.models' in sys.modules:
                        if hasattr(sys.modules['diffusers.models'], 'embeddings'):
                            sys.modules['diffusers.models'].embeddings.get_1d_sincos_pos_embed_from_grid = _patched_get_1d_sincos_pos_embed_from_grid
                    
                    logger.info("✅ MPS 호환성 패치 재적용 완료 (pipeline 로드 전)")
                except Exception as patch_error:
                    logger.warning(f"⚠️  Pipeline 로드 전 패치 적용 실패: {patch_error}")
            
            # Get model ID
            model_id = (
                self.model_mapping
                .get(self.model_type, {})
                .get(self.model_size, {})
                .get(self.resolution)
            )

            if not model_id:
                raise ValueError(
                    f"Invalid configuration: type={self.model_type}, "
                    f"size={self.model_size}, resolution={self.resolution}"
                )

            logger.info(f"Loading model: {model_id}")

            # Load VAE with float32 (required for quality)
            logger.info("Loading VAE (float32)...")
            vae = AutoModel.from_pretrained(
                model_id,
                subfolder="vae",
                torch_dtype=torch.float32,
                cache_dir=self.model_cache_dir,
            )

            # Load Transformer with bfloat16 (memory optimization)
            logger.info("Loading Transformer (bfloat16)...")
            transformer = AutoModel.from_pretrained(
                model_id,
                subfolder="transformer",
                torch_dtype=torch.bfloat16,
                cache_dir=self.model_cache_dir,
            )

            # Select pipeline class and flow_shift
            if self.model_type == "i2v":
                PipelineClass = SkyReelsV2DiffusionForcingImageToVideoPipeline
                flow_shift = 5.0
                logger.info("Using Image-to-Video pipeline (flow_shift=5.0)")
            else:  # t2v or df
                PipelineClass = SkyReelsV2DiffusionForcingPipeline
                flow_shift = 8.0
                logger.info("Using Text-to-Video/DF pipeline (flow_shift=8.0)")

            # Initialize pipeline
            logger.info("Initializing pipeline...")
            self.pipeline = PipelineClass.from_pretrained(
                model_id,
                vae=vae,
                transformer=transformer,
                torch_dtype=torch.bfloat16,
                cache_dir=self.model_cache_dir,
            )

            # Configure scheduler with flow_shift
            logger.info("Configuring scheduler...")
            self.pipeline.scheduler = UniPCMultistepScheduler.from_config(
                self.pipeline.scheduler.config,
                flow_shift=flow_shift
            )

            # Move to GPU
            logger.info(f"Moving pipeline to {self.device}...")
            self.pipeline = self.pipeline.to(self.device)
            
            # MPS 호환성 패치를 pipeline 로드 후에도 다시 적용 (transformer 모듈이 로드된 후)
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                try:
                    import importlib
                    # transformer 모듈을 강제로 다시 로드
                    if 'diffusers.models.transformers.transformer_skyreels_v2' in sys.modules:
                        importlib.reload(sys.modules['diffusers.models.transformers.transformer_skyreels_v2'])
                    
                    # embeddings 모듈의 패치된 함수 가져오기
                    import diffusers.models.embeddings as embeddings_module
                    patched_func = embeddings_module.get_1d_sincos_pos_embed_from_grid
                    
                    # transformer 모듈을 import하고 내부의 함수 참조 업데이트
                    import diffusers.models.transformers.transformer_skyreels_v2 as transformer_module
                    # 모듈 내부에서 직접 import한 경우를 대비하여 모듈의 __dict__를 확인
                    for attr_name in dir(transformer_module):
                        attr = getattr(transformer_module, attr_name)
                        # 함수가 get_1d_sincos_pos_embed_from_grid를 참조하는 경우 업데이트
                        if callable(attr) and hasattr(attr, '__globals__'):
                            try:
                                if 'get_1d_sincos_pos_embed_from_grid' in attr.__globals__:
                                    attr.__globals__['get_1d_sincos_pos_embed_from_grid'] = patched_func
                            except:
                                pass
                    
                    logger.info("✅ MPS 호환성 패치 재적용 완료 (pipeline 로드 후)")
                except Exception as patch_error:
                    logger.warning(f"⚠️  Pipeline 로드 후 패치 적용 실패: {patch_error}")

            # Enable memory optimizations
            if self.device == "cuda":
                logger.info("Enabling model CPU offloading...")
                self.pipeline.enable_model_cpu_offload()
            elif self.device == "mps":
                # MPS 메모리 최적화 - 큰 버퍼 크기 문제 해결
                logger.info("MPS 모드: Metal Performance Shaders 사용 중")
                logger.info("MPS 메모리 최적화 적용 중...")
                
                # Attention slicing 활성화 (큰 attention 행렬을 작은 청크로 분할)
                # MPS의 버퍼 크기 제한을 피하기 위해 작은 slice_size 사용
                try:
                    # "max" 대신 작은 값 사용 (예: 1 또는 "auto")
                    self.pipeline.enable_attention_slicing(slice_size=1)
                    logger.info("✅ Attention slicing 활성화됨 (slice_size=1)")
                except Exception as e:
                    logger.warning(f"⚠️  Attention slicing 활성화 실패: {e}")
                    # slice_size=1이 실패하면 "auto" 시도
                    try:
                        self.pipeline.enable_attention_slicing(slice_size="auto")
                        logger.info("✅ Attention slicing 활성화됨 (slice_size=auto)")
                    except Exception as e2:
                        logger.warning(f"⚠️  Attention slicing (auto) 활성화 실패: {e2}")
                
                # VAE slicing 활성화 (VAE 메모리 사용량 감소)
                try:
                    self.pipeline.enable_vae_slicing()
                    logger.info("✅ VAE slicing 활성화됨")
                except Exception as e:
                    logger.warning(f"⚠️  VAE slicing 활성화 실패: {e}")
                
                # VAE tiling 활성화 (큰 이미지를 타일로 분할)
                try:
                    self.pipeline.enable_vae_tiling()
                    logger.info("✅ VAE tiling 활성화됨")
                except Exception as e:
                    logger.warning(f"⚠️  VAE tiling 활성화 실패: {e}")
                
                # MPS는 자동으로 메모리를 관리하지만, 위 최적화로 큰 버퍼 크기 문제를 해결합니다

            logger.info("Pipeline loaded successfully!")

        except Exception as e:
            logger.error(f"Error loading pipeline: {e}", exc_info=True)
            raise

    def generate(
        self,
        prompt: str,
        num_frames: int = 97,
        guidance_scale: float = 6.0,
        num_inference_steps: int = 30,
        image_path: Optional[str] = None,
        output_dir: str = "/tmp",
        seed: Optional[int] = None,
    ) -> str:
        """
        Generate video and return local file path

        Args:
            prompt: Text prompt for generation
            num_frames: Number of frames (97 for 540P, 121 for 720P recommended)
            guidance_scale: Guidance scale (T2V: 6-8, I2V: 5-6)
            num_inference_steps: Number of inference steps (default: 30)
            image_path: Path to input image (required for I2V)
            output_dir: Directory to save output video
            seed: Random seed for reproducibility

        Returns:
            Path to generated video file
        """
        try:
            logger.info(f"Generating video with prompt: '{prompt}'")
            logger.info(
                f"Parameters: frames={num_frames}, guidance={guidance_scale}, "
                f"steps={num_inference_steps}, seed={seed}"
            )

            # Validate inputs
            if self.model_type == "i2v" and not image_path:
                raise ValueError("Image path is required for I2V mode")

            # Prepare generator
            generator = None
            if seed is not None:
                generator = torch.Generator(device=self.device)
                generator.manual_seed(seed)

            # Calculate resolution
            if self.resolution == "540P":
                height, width = 544, 960
                base_num_frames = 97
            else:  # 720P
                height, width = 720, 1280
                base_num_frames = 121

            # Adjust for 1.3B model (use smaller resolution if needed)
            if self.model_size == "1.3B" and self.resolution == "720P":
                logger.warning("1.3B model using 540P resolution as fallback")
                height, width = 544, 960
                base_num_frames = 97
            
            # MPS 메모리 최적화: 프레임 수 제한 (큰 attention 행렬 방지)
            original_num_frames = num_frames
            if self.device == "mps" and num_frames > 49:
                logger.warning(f"MPS 메모리 최적화: 프레임 수를 {num_frames}에서 49로 제한합니다 (큰 attention 행렬 방지)")
                num_frames = 49
                # base_num_frames도 조정
                if base_num_frames > 49:
                    base_num_frames = 49

            # Prepare pipeline arguments
            common_kwargs = {
                "prompt": prompt,
                "height": height,
                "width": width,
                "num_frames": num_frames,
                "guidance_scale": guidance_scale,
                "num_inference_steps": num_inference_steps,
            }

            if generator:
                common_kwargs["generator"] = generator

            # Generate based on model type
            if self.model_type == "i2v":
                logger.info(f"Loading image: {image_path}")
                image = load_image(image_path)

                logger.info("I2V: Pipeline 실행 시작 (시간이 걸릴 수 있습니다)...")
                output = self.pipeline(
                    image=image,
                    **common_kwargs
                ).frames[0]
                logger.info("I2V: Pipeline 실행 완료")

            else:  # t2v or df
                logger.info("T2V/DF: Pipeline 실행 시작 (시간이 걸릴 수 있습니다)...")
                logger.info(f"  - 프레임 수: {num_frames}")
                logger.info(f"  - Inference steps: {num_inference_steps}")
                logger.info(f"  - Device: {self.device}")
                output = self.pipeline(
                    **common_kwargs,
                    base_num_frames=base_num_frames,
                    ar_step=5,
                    causal_block_size=5,
                ).frames[0]
                logger.info("T2V/DF: Pipeline 실행 완료")

            # Save video
            output_path = Path(output_dir) / "output.mp4"
            output_path.parent.mkdir(parents=True, exist_ok=True)

            logger.info(f"Saving video to: {output_path}")
            export_to_video(output, str(output_path), fps=24, quality=8)

            logger.info(f"Video generated successfully: {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Error generating video: {e}", exc_info=True)
            raise

    def generate_thumbnail(self, video_path: str, output_path: Optional[str] = None) -> str:
        """
        Generate thumbnail from first frame of video

        Args:
            video_path: Path to video file
            output_path: Optional output path for thumbnail

        Returns:
            Path to thumbnail image
        """
        try:
            if output_path is None:
                video_dir = Path(video_path).parent
                output_path = str(video_dir / "thumbnail.jpg")

            # Open video
            cap = cv2.VideoCapture(video_path)

            # Read first frame
            ret, frame = cap.read()
            if not ret:
                raise ValueError("Could not read video frame")

            # Save thumbnail
            cv2.imwrite(output_path, frame)
            cap.release()

            logger.info(f"Thumbnail saved to: {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Error generating thumbnail: {e}", exc_info=True)
            raise

    def cleanup(self):
        """Clean up resources and free GPU memory"""
        try:
            if self.pipeline is not None:
                logger.info("Cleaning up pipeline...")
                del self.pipeline
                self.pipeline = None

                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    logger.info("CUDA cache cleared")
                elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    # MPS는 자동으로 메모리를 관리하므로 명시적인 캐시 클리어가 필요 없습니다
                    logger.info("MPS memory managed automatically")

            logger.info("Cleanup completed")

        except Exception as e:
            logger.warning(f"Error during cleanup: {e}")

    def get_memory_usage(self) -> dict:
        """Get current GPU memory usage"""
        if torch.cuda.is_available():
            return {
                "device": "cuda",
                "available": True,
                "allocated_gb": torch.cuda.memory_allocated() / 1024**3,
                "reserved_gb": torch.cuda.memory_reserved() / 1024**3,
                "max_allocated_gb": torch.cuda.max_memory_allocated() / 1024**3,
            }
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            # MPS는 메모리 사용량을 직접 조회할 수 없지만, 사용 중임을 표시
            return {
                "device": "mps",
                "available": True,
                "note": "MPS (Metal Performance Shaders) 사용 중 - 메모리는 시스템이 자동 관리합니다",
            }
        else:
            return {
                "device": "cpu",
                "available": False,
                "note": "CPU 모드 - GPU를 사용할 수 없습니다",
            }
