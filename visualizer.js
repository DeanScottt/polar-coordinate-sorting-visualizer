"use strict";

function shuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const rand = Math.floor(Math.random() * (i + 1));
		if (rand === i) continue;
		[arr[i], arr[rand]] = [arr[rand], arr[i]];
	}
}

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d", {alpha: false});

const dataSize = 50000;
const center = 1000;
const radius = 950;
const dotSize = 1.5;
const tau = Math.PI * 2;
let swapBatchSize = 1000;

const data = [];
const normals = [];
const colors = [];

for (let i = 0; i < dataSize; i++) {
	data.push(i);

	const angle = (tau * (i / dataSize) + (Math.PI / 2)) % tau;
	normals.push({x: Math.cos(angle), y: Math.sin(angle)});

	const r = Math.sin(angle) * 127 + 128;
	const g = Math.sin(angle + (tau / 3)) * 127 + 128;
	const b = Math.sin(angle + (2 * tau / 3)) * 127 + 128;
	colors.push([r, g, b]);
}

shuffle(data);
data.forEach((n, i) => renderDot(n, i));

function renderDot(n, i) {
	const diff = Math.abs(n - i);
	const displacement = Math.min(diff, dataSize - diff);
	const dist = radius * (1 - displacement / (dataSize >> 1));
	const x = (center + dist * normals[i].x);
	const y = (center + dist * normals[i].y);

	if (!colors[n]) console.log(n);
	ctx.fillStyle = `rgb(${colors[n].join(",")})`;
	ctx.beginPath();
	ctx.arc(x, y, dotSize, 0, tau);
	ctx.fill();
}

function sort() {
	if (!sorting) return;
	const result = sorter.next();
	if (result.done) {
		sorting = false;
		sorter = null;
		return;
	}

	ctx.clearRect(0, 0, 2000, 2000);

	for (let i = 0; i < dataSize; i++) renderDot(data[i], i);

	setTimeout(sort, 10);
}

//* ---------- Sorters ----------

function* insertion() {
	let batch = 0;
	let farthest = 1;
	let i = 1;
	while (i < dataSize) {
		if (i > farthest) {
			farthest = i;
			batch++;
		}
		while (i > 0 && data[i] < data[i - 1]) {
			[data[i], data[i-1]] = [data[i-1], data[i]];
			i--;
		}
		if (batch >= swapBatchSize) yield batch = 0;
		i++;
	}
	if (batch) yield batch = 0;
}

function* bubble() {
	let batch = 0;
	let sorted = false;
	let loops = 0;
	while (!sorted) {
		sorted = true;
		loops++;

		for (let i = 0; i < dataSize - loops; i++) {
			if (data[i] <= data[i + 1]) continue;
			sorted = false;
			[data[i], data[i + 1]] = [data[i + 1], data[i]];
		}

		if (++batch >= swapBatchSize) yield batch = 0;
	}
	if (batch) yield batch = 0;
}

function* selection() {
	let batch = 0;

	for (let i = 0; i < dataSize - 1; i++) {
		const idx = data.indexOf(i, i);
		if (idx === i) continue;
		[data[i], data[idx]] = [data[idx], data[i]];
		if (++batch >= swapBatchSize) yield batch = 0;
	}

	if (batch) yield batch = 0;
}

function* quick() {
	let batch = 0;

  function pickPivot(left, right) {
    let [low, lowIdx] = [data[left], left];
    let [high, highIdx] = [data[right], right];
    let [mid, midIdx] = [data[left + ((right - left) >> 1)], left + ((right - left) >> 1)];
    if (low > mid) {
      [low, mid] = [mid, low];
      [lowIdx, midIdx] = [midIdx, lowIdx];
    }
    if (mid > high) {
      [mid, high] = [high, mid];
      [midIdx, highIdx] = [highIdx, midIdx];
    }
    if (low > mid) {
      [low, mid] = [mid, low];
      [lowIdx, midIdx] = [midIdx, lowIdx];
    }
    return [mid, midIdx];
  }

  function* partition(left, right) {
    if (left >= right) {return};
    if (left === right - 1) {
      if (data[left] > data[right]) {
				[data[left], data[right]] = [data[right], data[left]];
				if (++batch >= swapBatchSize) yield batch = 0;
			}
      return;
    }

    const [pivot, pivotIdx] = pickPivot(left, right);
    if (pivotIdx !== right) {
      [data[right], data[pivotIdx]] = [data[pivotIdx], data[right]];
      if (++batch >= swapBatchSize) yield batch = 0;
    }

    let rightPointer = right - 1;
    let leftPointer = left;

    while (true) {
      while (data[rightPointer] > pivot) {rightPointer--};
      while (data[leftPointer] < pivot) {leftPointer++};
      if (leftPointer < rightPointer) {
        [data[leftPointer], data[rightPointer]] = [data[rightPointer], data[leftPointer]];
        if (++batch >= swapBatchSize) yield batch = 0;
      } else {break};
      leftPointer++;
      rightPointer--;
    }

    [data[right], data[leftPointer]] = [data[leftPointer], data[right]];
    if (++batch >= swapBatchSize) yield batch = 0;

    yield* partition(left, leftPointer - 1);
    yield* partition(leftPointer + 1, right);
  }

  yield* partition(0, dataSize - 1);
	if (batch) yield batch = 0;
}

function* radix() {
	let batch = 0;
	const fillCycles = Math.floor(Math.log10(dataSize - 1)) + 1;

	for (let place = 0; place < fillCycles; place++) {
		const buckets = Array.from({length: 10}, () => []);
		
		for (let i = 0; i < dataSize; i++) buckets[Math.floor(data[i] / (10 ** place)) % 10].push(data[i]);

		const writePointers = Array(10);
		let currOffset = 0;
		for (let b = 0; b < 10; b++) {
			writePointers[b] = currOffset;
			currOffset += buckets[b].length;
		}
		const bucketCounters = Array(10).fill(0);
		let written = 0;

		while (written < dataSize) {
			for (let b = 0; b < 10; b++) {
				if (bucketCounters[b] < buckets[b].length) {
					const val = buckets[b][bucketCounters[b]];
					const destination = writePointers[b];

					data[destination] = val;

					batch++;
					bucketCounters[b]++;
					writePointers[b]++;
					written++;

					if (batch >= swapBatchSize) yield batch = 0;
				}
			}
		}
		if (batch) yield batch = 0;
	}
}

function* merge() {
	let batch = 0;
	const aux = [...data];

	yield* split(0, dataSize - 1);

	function* split(left, right) {
		if (left >= right) return;

		const mid = left + ((right - left) >> 1);
		
		yield* split(left, mid);
		yield* split(mid + 1, right);

		yield* combine(left, mid, right);
	}

	function* combine(left, mid, right) {
		for (let i = left; i <= right; i++) aux[i] = data[i];
		let leftPointer = left, rightPointer = mid + 1, writeTo = left;

		while (leftPointer <= mid && rightPointer <= right) {
			if (aux[leftPointer] <= aux[rightPointer]) {
				data[writeTo++] = aux[leftPointer++];
			} else {
				data[writeTo++] = aux[rightPointer++];
			}
			if (++batch >= swapBatchSize) yield batch = 0;
		}

		while (leftPointer <= mid) {
			data[writeTo++] = aux[leftPointer++];
			if (++batch >= swapBatchSize) yield batch = 0;
		}

		while (rightPointer <= right) {
			data[writeTo++] = aux[rightPointer++];
			if (++batch >= swapBatchSize) yield batch = 0;
		}
	}

	if (batch) yield batch = 0;
}

function* tim() {
	let batch = 0;
	const minMerge = 8192;
	const minRun = getMinRun(dataSize);
	const runs = [];
	const aux = Array(dataSize);

	function getMinRun(n) {
		let bitRemainder = 0;
		while (n >= minMerge) {
			bitRemainder |= (n & 1);
			n >>= 1;
		}
		return n + bitRemainder;
	}

	function findRun(start, n) {
		let end = start + 1;
		if (end === n) return end;

		if (data[end] < data[start]) {
			while (end < n && data[end] < data[end - 1]) end++;
			let sub = data.slice(start, end).reverse();
			for (let i = start; i < end; i++) data[i] = sub[i - start];

		} else {
			while (end < n && data[end] >= data[end - 1]) end++;
		}

		return end;
	}

	function* insertionSort(left, right) {
		for (let i = left + 1; i <= right; i++) {
			const val = data[i];
			let insertPoint = i - 1;
			while (insertPoint >= left && data[insertPoint] > val) data[insertPoint + 1] = data[insertPoint--];
			data[insertPoint + 1] = val;
			if (++batch >= swapBatchSize) yield batch = 0;
		}
	}

	function* mergeRuns(left, mid, right) {
		//* forward merge
		if ((mid + 1 - left) <= (right - mid)) {
			for (let i = left; i <= mid; i++) aux[i] = data[i];
			let leftPointer = left, rightPointer = mid + 1, writeTo = left;

			while (leftPointer <= mid && rightPointer <= right) {
				if (aux[leftPointer] <= data[rightPointer]) {
					data[writeTo++] = aux[leftPointer++];
				} else {
					data[writeTo++] = data[rightPointer++];
				}
				if (++batch >= swapBatchSize) yield batch = 0;
			}

			while (leftPointer <= mid) {
				data[writeTo++] = aux[leftPointer++];
				if (++batch >= swapBatchSize) yield batch = 0;
			}

		//* reverse merge
		} else {
			for (let i = mid + 1; i <= right; i++) aux[i] = data[i];
			let leftPointer = mid, rightPointer = right, writeTo = right;

			while (leftPointer >= left && rightPointer >= mid + 1) {
				if (aux[rightPointer] >= data[leftPointer]) {
					data[writeTo--] = aux[rightPointer--];
					if (++batch >= swapBatchSize) yield batch = 0;
				} else {
					data[writeTo--] = data[leftPointer--];
					if (++batch >= swapBatchSize) yield batch = 0;
				}
			}

			while (rightPointer >= mid + 1) {
				data[writeTo--] = aux[rightPointer--];
				if (++batch >= swapBatchSize) yield batch = 0;
			}
		}
	}

	let i = 0;
	while (i < dataSize) {
		let runEnd = findRun(i, dataSize);
		let runLength = runEnd - i;

		if (runLength < minRun) {
			let end = Math.min(i + minRun, dataSize);
			yield* insertionSort(i, end - 1);
			runEnd = end;
		}

		runs.push([i, runEnd]);
		i = runEnd;

		while (runs.length > 1) {
			const [startA, endA] = runs.at(-2);
			const [startB, endB] = runs.at(-1);
			const lengthA = endA - startA, lengthB = endB - startB;

			if (lengthA <= lengthB) {
				yield* mergeRuns(startA, endA - 1, endB - 1);
				runs.splice(-2, 2, [startA, endB]);
			} else break;
		}

	}

	while (runs.length > 1) {
		const [startA, endA] = runs.at(-2);
		const [startB, endB] = runs.at(-1);

		yield* mergeRuns(startA, endA - 1, endB - 1);
		runs.splice(-2, 2, [startA, endB]);
	}
	
	yield batch = 0;
}

function* mergeBottomUp() {
	let batch = 0;
	const aux = Array(dataSize);

	function* mergeRuns(left, mid, right) {
		for (let i = left; i <= right; i++) aux[i] = data[i];
		let leftPointer = left, rightPointer = mid + 1, writeTo = left;

		while (leftPointer <= mid && rightPointer <= right) {
			if (aux[leftPointer] <= aux[rightPointer]) {
				data[writeTo++] = aux[leftPointer++];
			} else {
				data[writeTo++] = aux[rightPointer++];
			}
			if (++batch >= swapBatchSize) yield batch = 0;
		}

		while (leftPointer <= mid) {
			data[writeTo++] = aux[leftPointer++];
			if (++batch >= swapBatchSize) yield batch = 0;
		}
		
		while (rightPointer <= right) {
			data[writeTo++] = aux[rightPointer++];
			if (++batch >= swapBatchSize) yield batch = 0;
		}
	}

	for (let width = 1; width < dataSize; width *= 2) {
		for (let left = 0; left < dataSize; left += 2 * width) {
			const mid = Math.min(left + width - 1, dataSize - 1);
			const right = Math.min(left + 2 * width - 1, dataSize - 1);
			if (mid < right) yield* mergeRuns(left, mid, right);
		}
	}

	if (batch) yield batch = 0;
}

function* oddEven() {
	let batch = 0;
	let sorted = false;

	while (!sorted) {
		sorted = true;

		for (let i = 1; i < dataSize - 1; i += 2) {
			if (data[i] > data[i + 1]) {
				[data[i], data[i + 1]] = [data[i + 1], data[i]];
				sorted = false;
			}
		}
		if (++batch >= swapBatchSize) yield batch = 0;
		
		for (let i = 0; i < dataSize - 1; i += 2) {
			if (data[i] > data[i + 1]) {
				[data[i], data[i + 1]] = [data[i + 1], data[i]];
				sorted = false;
			}
		}
		if (++batch >= swapBatchSize) yield batch = 0;
	}

	if (batch) yield batch = 0;
}

function* cocktail() {
	let batch = 0;
	let sorted = false;
	let loops = 0;

	while (!sorted) {
		loops++;
		sorted = true;

		for (let i = loops - 1; i < dataSize - loops; i++) {
			sorted = false;
			if (data[i] > data[i + 1]) [data[i], data[i + 1]] = [data[i + 1], data[i]];
		}
		if (++batch >= swapBatchSize) yield batch = 0;

		for (let i = dataSize - loops; i >= loops; i--) {
			sorted = false;
			if (data[i] < data[i - 1]) [data[i], data[i - 1]] = [data[i - 1], data[i]];
		}
		if (++batch >= swapBatchSize) yield batch = 0;
	}

	if (batch) yield batch = 0;
}

function* radixB2() {
	let batch = 0;

	function getNumBits(n) {
		for (let bit = 31; bit >= 0; bit--) {
			if (n & (1 << bit)) return bit + 1;
		}
	}

	const numBits = getNumBits(dataSize - 1);
	for (let bit = 0; bit < numBits; bit++) {
		const buckets = [[], []];
		for (let i = 0; i < dataSize; i++) buckets[(data[i] & (1 << bit)) ? 1 : 0].push(data[i]);

		let write = 0;
		for (const bucket of buckets) {
			for (let i = 0; i < bucket.length; i++) {
				data[write++] = bucket[i];
				if (++batch >= swapBatchSize) yield batch = 0;
			}
		}
	}

	if (batch) yield;
}

//* ---------- Listeners ----------

let activeAlg = null;
let sorter = null;
let sorting = false;

document.querySelectorAll("button").forEach(btn => {
	const buttonName = btn.dataset.name;
	let callBack;

	function setButton(button) {
		const curr = document.querySelector(".applied");
		if (curr) curr.classList.remove("applied");
		button.classList.add("applied");
	}

	switch (buttonName) {
		case "sort":
			callBack = () => {
				if (sorting || !activeAlg) return;
				sorter = activeAlg();
				sorting = true;
				sort();
			}
			break;

		case "scramble":
			callBack = () => {
				sorting = false;
				sorter = null;
				shuffle(data);
				ctx.clearRect(0, 0, 2000, 2000);
				data.forEach((n, i) => renderDot(n, i));
			}
			break;

		case "bubble":
			callBack = setSorter.bind(null, btn, bubble, 200);
			break;
		case "cocktail":
			callBack = setSorter.bind(null, btn, cocktail, 200);
			break;
		case "insertion":
			callBack = setSorter.bind(null, btn, insertion, 300);
			break;
		case "selection":
			callBack = setSorter.bind(null, btn, selection, 200);
			break;
		case "merge":
			callBack = setSorter.bind(null, btn, merge, 2000);
			break;
		case "mergeBottomUp":
			callBack = setSorter.bind(null, btn, mergeBottomUp, 3000);
			break;
		case "quick":
			callBack = setSorter.bind(null, btn, quick, 1000);
			break;
		case "radix":
			callBack = setSorter.bind(null, btn, radixB2, 1000);
			break;
		case "oddEven":
			callBack = setSorter.bind(null, btn, oddEven, 150);
			break;
		case "tim":
			callBack = setSorter.bind(null, btn, tim, 500);
	}

	function setSorter(btn, fn, batch) {
		setButton(btn);
		activeAlg = fn;
		swapBatchSize = batch;
	}

	btn.addEventListener("click", () => {
		callBack();
		if (!sorting && activeAlg) {
			document.querySelector(".sort").classList.remove("disabled");
		} else {
			document.querySelector(".sort").classList.add("disabled");
		}
	});
});



window.addEventListener("orientationchange", () => {
	setTimeout(() => {
		window.scrollTo(0, 0);
		document.body.style.display = "none";
		document.body.offsetHeight;
		document.body.style.display = "";
	}, 50);
});