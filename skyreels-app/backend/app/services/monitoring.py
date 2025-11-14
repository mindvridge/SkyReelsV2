"""
Monitoring and metrics service for local development

Simple metrics collection and reporting for local environments
"""

import time
import logging
import psutil
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


class MetricsCollector:
    """
    Lightweight metrics collector for local monitoring

    Tracks:
    - API request metrics (count, duration, errors)
    - System metrics (CPU, memory, disk)
    - Video generation metrics (count, duration, success rate)
    - WebSocket connections
    """

    def __init__(self, max_history: int = 1000):
        self.max_history = max_history

        # API metrics
        self.api_requests: deque = deque(maxlen=max_history)
        self.api_errors: deque = deque(maxlen=max_history)

        # Video generation metrics
        self.video_generations: deque = deque(maxlen=max_history)
        self.video_completions: deque = deque(maxlen=max_history)
        self.video_failures: deque = deque(maxlen=max_history)

        # Timing metrics
        self.request_durations: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.generation_durations: deque = deque(maxlen=100)

        # Counters
        self.total_requests = 0
        self.total_errors = 0
        self.total_videos_generated = 0
        self.total_videos_completed = 0
        self.total_videos_failed = 0

        # Start time
        self.start_time = datetime.now()

    def record_api_request(self, endpoint: str, method: str, status_code: int, duration: float):
        """Record an API request"""
        self.total_requests += 1

        self.api_requests.append({
            'endpoint': endpoint,
            'method': method,
            'status_code': status_code,
            'duration': duration,
            'timestamp': datetime.now(),
        })

        # Record duration for this endpoint
        self.request_durations[f"{method}:{endpoint}"].append(duration)

        # Record errors
        if status_code >= 400:
            self.total_errors += 1
            self.api_errors.append({
                'endpoint': endpoint,
                'method': method,
                'status_code': status_code,
                'timestamp': datetime.now(),
            })

    def record_video_generation_start(self, job_id: str, model_type: str, model_size: str):
        """Record video generation start"""
        self.total_videos_generated += 1

        self.video_generations.append({
            'job_id': job_id,
            'model_type': model_type,
            'model_size': model_size,
            'start_time': datetime.now(),
        })

    def record_video_generation_complete(self, job_id: str, duration: float):
        """Record video generation completion"""
        self.total_videos_completed += 1

        self.video_completions.append({
            'job_id': job_id,
            'duration': duration,
            'timestamp': datetime.now(),
        })

        self.generation_durations.append(duration)

    def record_video_generation_failure(self, job_id: str, error: str):
        """Record video generation failure"""
        self.total_videos_failed += 1

        self.video_failures.append({
            'job_id': job_id,
            'error': error,
            'timestamp': datetime.now(),
        })

    def get_system_metrics(self) -> Dict:
        """Get current system metrics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')

            return {
                'cpu': {
                    'percent': cpu_percent,
                    'count': psutil.cpu_count(),
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'percent': memory.percent,
                    'used': memory.used,
                },
                'disk': {
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': disk.percent,
                },
            }
        except Exception as e:
            logger.error(f"Error getting system metrics: {e}")
            return {}

    def get_api_metrics(self, last_n_minutes: int = 60) -> Dict:
        """Get API metrics for last N minutes"""
        cutoff_time = datetime.now() - timedelta(minutes=last_n_minutes)

        recent_requests = [r for r in self.api_requests if r['timestamp'] > cutoff_time]
        recent_errors = [e for e in self.api_errors if e['timestamp'] > cutoff_time]

        # Calculate stats
        total_requests = len(recent_requests)
        total_errors = len(recent_errors)
        error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0

        # Average durations by endpoint
        endpoint_stats = defaultdict(lambda: {'count': 0, 'total_duration': 0})
        for req in recent_requests:
            key = f"{req['method']}:{req['endpoint']}"
            endpoint_stats[key]['count'] += 1
            endpoint_stats[key]['total_duration'] += req['duration']

        avg_durations = {
            endpoint: {
                'count': stats['count'],
                'avg_duration': stats['total_duration'] / stats['count'],
            }
            for endpoint, stats in endpoint_stats.items()
        }

        return {
            'total_requests': total_requests,
            'total_errors': total_errors,
            'error_rate': round(error_rate, 2),
            'endpoints': avg_durations,
            'recent_errors': [
                {
                    'endpoint': e['endpoint'],
                    'status': e['status_code'],
                    'time': e['timestamp'].isoformat(),
                }
                for e in list(recent_errors)[-10:]  # Last 10 errors
            ],
        }

    def get_video_metrics(self, last_n_minutes: int = 60) -> Dict:
        """Get video generation metrics"""
        cutoff_time = datetime.now() - timedelta(minutes=last_n_minutes)

        recent_completions = [c for c in self.video_completions if c['timestamp'] > cutoff_time]
        recent_failures = [f for f in self.video_failures if f['timestamp'] > cutoff_time]

        total_videos = len(recent_completions) + len(recent_failures)
        success_rate = (len(recent_completions) / total_videos * 100) if total_videos > 0 else 0

        # Average generation time
        avg_duration = (
            sum(c['duration'] for c in recent_completions) / len(recent_completions)
            if recent_completions else 0
        )

        return {
            'total_videos': total_videos,
            'completed': len(recent_completions),
            'failed': len(recent_failures),
            'success_rate': round(success_rate, 2),
            'avg_generation_time': round(avg_duration, 2),
            'recent_failures': [
                {
                    'job_id': f['job_id'],
                    'error': f['error'][:100],  # Truncate error
                    'time': f['timestamp'].isoformat(),
                }
                for f in list(recent_failures)[-10:]  # Last 10 failures
            ],
        }

    def get_summary(self) -> Dict:
        """Get overall summary"""
        uptime = datetime.now() - self.start_time

        return {
            'uptime_seconds': int(uptime.total_seconds()),
            'uptime_hours': round(uptime.total_seconds() / 3600, 2),
            'total_api_requests': self.total_requests,
            'total_api_errors': self.total_errors,
            'total_videos_generated': self.total_videos_generated,
            'total_videos_completed': self.total_videos_completed,
            'total_videos_failed': self.total_videos_failed,
            'overall_success_rate': round(
                (self.total_videos_completed / self.total_videos_generated * 100)
                if self.total_videos_generated > 0 else 0,
                2
            ),
        }


# Global metrics collector instance
metrics_collector = MetricsCollector()


def get_metrics_collector() -> MetricsCollector:
    """Get global metrics collector instance"""
    return metrics_collector
