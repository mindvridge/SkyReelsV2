"""SkyReels V2 video generation service - Official API Integration"""

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
        
        if self.device == "cpu":
            logger.warning(
                "⚠️  CPU 모드로 실행 중입니다. "
                "Docker 컨테이너 내부에서는 macOS GPU(Metal)를 사용할 수 없으므로 "
                "시스템 RAM을 사용하며 매우 느립니다."
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

            # Enable memory optimizations
            if self.device == "cuda":
                logger.info("Enabling model CPU offloading...")
                self.pipeline.enable_model_cpu_offload()

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

                output = self.pipeline(
                    image=image,
                    **common_kwargs
                ).frames[0]

            else:  # t2v or df
                output = self.pipeline(
                    **common_kwargs,
                    base_num_frames=base_num_frames,
                    ar_step=5,
                    causal_block_size=5,
                ).frames[0]

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
                    logger.info("GPU cache cleared")

            logger.info("Cleanup completed")

        except Exception as e:
            logger.warning(f"Error during cleanup: {e}")

    def get_memory_usage(self) -> dict:
        """Get current GPU memory usage"""
        if not torch.cuda.is_available():
            return {"available": False}

        return {
            "available": True,
            "allocated_gb": torch.cuda.memory_allocated() / 1024**3,
            "reserved_gb": torch.cuda.memory_reserved() / 1024**3,
            "max_allocated_gb": torch.cuda.max_memory_allocated() / 1024**3,
        }
