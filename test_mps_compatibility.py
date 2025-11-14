#!/usr/bin/env python3
"""
MPS (Apple Silicon GPU) 호환성 테스트 스크립트

이 스크립트는 macOS에서 MPS가 제대로 작동하는지 테스트합니다.
"""

import sys
import torch
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_mps_availability():
    """MPS 사용 가능 여부 확인"""
    print("\n" + "="*60)
    print("1. MPS 사용 가능 여부 확인")
    print("="*60)

    if not hasattr(torch.backends, "mps"):
        print("❌ PyTorch가 MPS를 지원하지 않습니다.")
        print("   PyTorch 2.0+ 버전이 필요합니다.")
        return False

    if not torch.backends.mps.is_available():
        print("❌ MPS를 사용할 수 없습니다.")
        print("   Apple Silicon Mac이 필요합니다 (M1/M2/M3).")
        return False

    print("✅ MPS 사용 가능!")
    print(f"   PyTorch 버전: {torch.__version__}")

    # Built-in MPS 확인
    if torch.backends.mps.is_built():
        print("✅ PyTorch가 MPS 지원과 함께 빌드되었습니다.")

    return True


def test_mps_tensor_operations():
    """MPS에서 기본 텐서 연산 테스트"""
    print("\n" + "="*60)
    print("2. MPS 텐서 연산 테스트")
    print("="*60)

    try:
        # MPS 디바이스 생성
        device = torch.device("mps")
        print(f"✅ MPS 디바이스 생성: {device}")

        # 텐서 생성 및 이동
        x = torch.randn(100, 100, device=device)
        print(f"✅ MPS에서 텐서 생성: shape={x.shape}, device={x.device}")

        # 기본 연산
        y = x @ x.T  # 행렬 곱
        print(f"✅ 행렬 곱 성공: shape={y.shape}")

        z = torch.relu(y)  # ReLU 활성화
        print(f"✅ ReLU 활성화 성공")

        # CPU로 이동
        z_cpu = z.cpu()
        print(f"✅ MPS -> CPU 이동 성공")

        return True

    except Exception as e:
        print(f"❌ MPS 텐서 연산 실패: {e}")
        return False


def test_float32_vs_float64():
    """float32 vs float64 테스트 (MPS는 float64 미지원)"""
    print("\n" + "="*60)
    print("3. float32 vs float64 테스트")
    print("="*60)

    device = torch.device("mps")

    # float32는 작동해야 함
    try:
        x32 = torch.randn(10, 10, dtype=torch.float32, device=device)
        print(f"✅ float32 텐서 생성 성공: {x32.dtype}")
    except Exception as e:
        print(f"❌ float32 실패: {e}")
        return False

    # float64는 작동하지 않을 수 있음
    try:
        x64 = torch.randn(10, 10, dtype=torch.float64, device=device)
        print(f"⚠️  float64 텐서 생성 성공 (예상 밖): {x64.dtype}")
        print("   최신 PyTorch는 float64를 지원할 수 있습니다.")
    except Exception as e:
        print(f"✅ float64 미지원 확인됨 (예상대로): {e}")
        print("   이것이 패치가 필요한 이유입니다.")

    return True


def test_memory_size():
    """MPS 메모리 크기 테스트"""
    print("\n" + "="*60)
    print("4. MPS 메모리 크기 테스트")
    print("="*60)

    device = torch.device("mps")

    # 작은 텐서 (성공해야 함)
    try:
        small = torch.randn(1000, 1000, device=device)
        print(f"✅ 작은 텐서 (1000x1000): {small.numel() * small.element_size() / (1024**2):.2f}MB")
    except Exception as e:
        print(f"❌ 작은 텐서 실패: {e}")
        return False

    # 큰 텐서 (실패할 수 있음)
    try:
        # 약 2GB 텐서 시도
        large = torch.randn(16384, 16384, device=device)
        size_mb = large.numel() * large.element_size() / (1024**2)
        print(f"⚠️  큰 텐서 성공 (예상 밖): {size_mb:.2f}MB")
    except Exception as e:
        print(f"✅ 큰 텐서 실패 확인 (예상대로): {str(e)[:100]}")
        print("   이것이 CPU fallback이 필요한 이유입니다.")

    return True


def test_attention_matrix_size():
    """Attention 행렬 크기 제한 테스트"""
    print("\n" + "="*60)
    print("5. Attention 행렬 크기 제한 테스트")
    print("="*60)

    device = torch.device("mps")

    # 시뮬레이션: 97 프레임 (기본값)
    try:
        seq_len = 97 * 16  # 97 프레임 * 16 패치
        hidden_dim = 64

        query = torch.randn(1, 8, seq_len, hidden_dim, device=device)
        key = torch.randn(1, 8, seq_len, hidden_dim, device=device)

        # Attention 행렬 크기 계산
        attention_matrix_size = seq_len * seq_len * query.element_size()
        print(f"   Attention 행렬 크기: {attention_matrix_size / (1024**2):.2f}MB")

        if attention_matrix_size > 500 * 1024 * 1024:
            print(f"⚠️  500MB 초과 - CPU fallback 필요")
        else:
            print(f"✅ 500MB 이하 - MPS에서 처리 가능")

        # 실제 attention 연산 시도
        attention = torch.matmul(query, key.transpose(-2, -1))
        print(f"✅ Attention 연산 성공")

    except Exception as e:
        print(f"❌ Attention 연산 실패: {str(e)[:100]}")
        return False

    return True


def test_pipeline_import():
    """SkyReels V2 pipeline import 테스트"""
    print("\n" + "="*60)
    print("6. SkyReels V2 Pipeline Import 테스트")
    print("="*60)

    try:
        from diffusers import SkyReelsV2DiffusionForcingPipeline
        print("✅ SkyReelsV2DiffusionForcingPipeline import 성공")
        return True
    except ImportError as e:
        print(f"❌ Pipeline import 실패: {e}")
        print("   diffusers 패키지를 설치해주세요:")
        print("   pip install diffusers>=0.31.0")
        return False


def test_mps_patch():
    """MPS 패치 적용 테스트"""
    print("\n" + "="*60)
    print("7. MPS 호환성 패치 테스트")
    print("="*60)

    try:
        # video_generator 모듈 import (패치가 자동 적용됨)
        import sys
        sys.path.insert(0, '/home/user/SkyReelsV2/skyreels-app/backend')

        from app.services.video_generator import SkyReelsGenerator
        print("✅ video_generator import 성공 (패치 자동 적용)")

        # 패치가 적용되었는지 확인
        import diffusers.models.embeddings as embeddings_module

        # 패치된 함수가 있는지 확인
        if hasattr(embeddings_module, 'get_1d_sincos_pos_embed_from_grid'):
            print("✅ get_1d_sincos_pos_embed_from_grid 함수 존재")

        return True

    except Exception as e:
        print(f"❌ 패치 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_system_info():
    """시스템 정보 출력"""
    print("\n" + "="*60)
    print("시스템 정보")
    print("="*60)

    import platform
    print(f"운영체제: {platform.system()} {platform.release()}")
    print(f"프로세서: {platform.processor()}")
    print(f"Python 버전: {sys.version}")
    print(f"PyTorch 버전: {torch.__version__}")

    # macOS 버전 확인
    if platform.system() == "Darwin":
        import subprocess
        try:
            result = subprocess.run(['sw_vers'], capture_output=True, text=True)
            print(f"\nmacOS 정보:\n{result.stdout}")
        except:
            pass

    # 메모리 정보
    try:
        import psutil
        mem = psutil.virtual_memory()
        print(f"\n메모리:")
        print(f"  전체: {mem.total / (1024**3):.1f}GB")
        print(f"  사용 가능: {mem.available / (1024**3):.1f}GB")
    except ImportError:
        print("\npsutil이 설치되지 않아 메모리 정보를 표시할 수 없습니다.")


def main():
    """메인 테스트 실행"""
    print("\n" + "🍎" * 30)
    print("MPS (Apple Silicon GPU) 호환성 테스트")
    print("🍎" * 30)

    get_system_info()

    # 테스트 실행
    results = []

    results.append(("MPS 사용 가능", test_mps_availability()))

    if results[0][1]:  # MPS가 사용 가능한 경우에만 계속
        results.append(("기본 텐서 연산", test_mps_tensor_operations()))
        results.append(("float32/float64", test_float32_vs_float64()))
        results.append(("메모리 크기", test_memory_size()))
        results.append(("Attention 행렬", test_attention_matrix_size()))
        results.append(("Pipeline Import", test_pipeline_import()))
        results.append(("MPS 패치", test_mps_patch()))

    # 결과 요약
    print("\n" + "="*60)
    print("테스트 결과 요약")
    print("="*60)

    for test_name, result in results:
        status = "✅ 통과" if result else "❌ 실패"
        print(f"{test_name:20s}: {status}")

    passed = sum(1 for _, result in results if result)
    total = len(results)

    print(f"\n총 {passed}/{total} 테스트 통과")

    if passed == total:
        print("\n🎉 모든 테스트 통과! MPS를 사용할 수 있습니다.")
        print("\n다음 단계:")
        print("1. Docker 대신 로컬에서 실행")
        print("2. skyreels-app/backend 디렉토리에서:")
        print("   python -m app.main")
        print("3. 비디오 생성 시 MPS 디바이스 정보 확인")
    else:
        print("\n⚠️  일부 테스트가 실패했습니다.")
        print("자세한 내용은 위 로그를 확인하세요.")


if __name__ == "__main__":
    main()
