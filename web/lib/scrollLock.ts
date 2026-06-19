let lockCount = 0;
let originalOverflow = '';

export function lockScroll() {
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount++;
}

export function unlockScroll() {
  lockCount--;
  if (lockCount <= 0) {
    lockCount = 0;
    document.body.style.overflow = originalOverflow;
  }
}
