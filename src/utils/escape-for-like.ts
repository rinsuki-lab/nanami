export function escapeForLike(input: string) {
	return input.replaceAll(/[\\%_]/g, (c) => "\\" + c);
}
