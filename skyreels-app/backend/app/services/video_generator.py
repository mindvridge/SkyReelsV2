"""SkyReels V2 video generation service"""

import os
import torch
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


class SkyReelsGenerator:
    """
    SkyReels V2 video generation service
    Supports Text-to-Video (T2V), Image-to-Video (I2V), and Diffusion Forcing (DF) modes
    """

    def __init__(self, model_type: str, resolution: str, model_cache_dir: str = "/models"):
        """
        Initialize the SkyReels generator with specified model type and resolution

        Args:
            model_type: One of 't2v', 'i2v', or 'df'
            resolution: One of '540P' or '720P'
            model_cache_dir: Directory for caching models
        """
        self.model_type = model_type.lower()
        self.resolution = resolution
        self.model_cache_dir = model_cache_dir
        self.pipeline = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        logger.info(f"Initializing SkyReels generator: {model_type}, {resolution}, device: {self.device}")

        # Load the appropriate pipeline
        self._load_pipeline()

    def _load_pipeline(self):
        """Load the appropriate Diffusers pipeline based on model type"""
        try:
            from diffusers import DiffusionPipeline

            # Determine model ID based on type and resolution
            model_mapping = {
                "t2v": {
                    "540P": "Skywork/SkyReels-V2-T2V-14B-540P",
                    "720P": "Skywork/SkyReels-V2-T2V-14B-720P",
                },
                "i2v": {
                    "540P": "Skywork/SkyReels-V2-I2V-14B-540P",
                    "720P": "Skywork/SkyReels-V2-I2V-14B-720P",
                },
                "df": {
                    "540P": "Skywork/SkyReels-V2-DF-14B-540P",
                    "720P": "Skywork/SkyReels-V2-DF-14B-720P",
                },
            }

            model_id = model_mapping.get(self.model_type, {}).get(self.resolution)
            if not model_id:
                raise ValueError(f"Invalid model type or resolution: {self.model_type}, {self.resolution}")

            logger.info(f"Loading model: {model_id}")

            # Load pipeline with optimizations
            self.pipeline = DiffusionPipeline.from_pretrained(
                model_id,
                torch_dtype=torch.bfloat16,
                cache_dir=self.model_cache_dir,
            )

            # Enable memory optimizations
            if self.device == "cuda":
                # Enable model offloading to save VRAM
                self.pipeline.enable_model_cpu_offload()
                # Enable VAE slicing
                if hasattr(self.pipeline, "enable_vae_slicing"):
                    self.pipeline.enable_vae_slicing()
                # Enable attention slicing
                if hasattr(self.pipeline, "enable_attention_slicing"):
                    self.pipeline.enable_attention_slicing(1)

            # VAE should use float32 for better quality
            if hasattr(self.pipeline, "vae"):
                self.pipeline.vae.to(dtype=torch.float32)

            logger.info("Pipeline loaded successfully")

        except Exception as e:
            logger.error(f"Error loading pipeline: {e}")
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
            num_frames: Number of frames (97 or 193)
            guidance_scale: Guidance scale (T2V: 8.0, I2V: 5.0, default: 6.0)
            num_inference_steps: Number of inference steps
            image_path: Path to input image (required for I2V)
            output_dir: Directory to save output video
            seed: Random seed for reproducibility

        Returns:
            Path to generated video file
        """
        try:
            logger.info(f"Generating video with prompt: '{prompt}'")

            # Validate inputs
            if self.model_type == "i2v" and not image_path:
                raise ValueError("Image path is required for I2V mode")

            # Prepare generation parameters
            generator = torch.Generator(device=self.device)
            if seed is not None:
                generator.manual_seed(seed)

            # Adjust flow_shift based on model type
            flow_shift = 8.0 if self.model_type == "t2v" else 5.0

            # Prepare pipeline inputs
            pipeline_inputs: Dict[str, Any] = {
                "prompt": prompt,
                "num_frames": num_frames,
                "guidance_scale": guidance_scale,
                "num_inference_steps": num_inference_steps,
                "generator": generator,
            }

            # Add flow_shift if supported
            if hasattr(self.pipeline, "transformer") and hasattr(self.pipeline.transformer.config, "flow_shift"):
                pipeline_inputs["flow_shift"] = flow_shift

            # For I2V, add image input
            if self.model_type == "i2v" and image_path:
                image = Image.open(image_path).convert("RGB")
                pipeline_inputs["image"] = image

            # Generate video
            logger.info(f"Starting generation with {num_frames} frames, {num_inference_steps} steps")
            output = self.pipeline(**pipeline_inputs)

            # Extract frames
            frames = output.frames[0]  # Get first (and only) video in batch

            # Save video
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, "output.mp4")

            self._save_video(frames, output_path)

            logger.info(f"Video saved to: {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Error generating video: {e}")
            raise

    def _save_video(self, frames: list, output_path: str, fps: int = 24):
        """
        Save frames as MP4 video

        Args:
            frames: List of PIL Image frames
            output_path: Output video path
            fps: Frames per second
        """
        # Convert PIL images to numpy arrays
        frame_arrays = [np.array(frame) for frame in frames]

        # Get dimensions
        height, width = frame_arrays[0].shape[:2]

        # Initialize video writer
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        # Write frames
        for frame in frame_arrays:
            # Convert RGB to BGR for OpenCV
            frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            out.write(frame_bgr)

        out.release()

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
                video_dir = os.path.dirname(video_path)
                output_path = os.path.join(video_dir, "thumbnail.jpg")

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
            logger.error(f"Error generating thumbnail: {e}")
            raise

    def cleanup(self):
        """Clean up resources"""
        if self.pipeline is not None:
            del self.pipeline
            self.pipeline = None
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            logger.info("Pipeline cleaned up")
