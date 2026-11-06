for (const button of document.querySelectorAll('[data-sheet]')) {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.sheet).showModal();
  });
}
