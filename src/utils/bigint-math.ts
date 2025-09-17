export const BigIntMath = {
	max: (first: bigint, ...args: bigint[]) => {
		return args.reduce((x, y) => (x > y ? x : y), first);
	},
	min: (first: bigint, ...args: bigint[]) => {
		return args.reduce((x, y) => (x < y ? x : y), first);
	},
};
