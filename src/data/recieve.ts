import { File, FileText, Image, Table } from "lucide-solid";
import type { FileItem } from "@/types/recieve";

export const FILES: FileItem[] = [
	{
		name: "Strategy_Deck.pdf",
		icon: FileText,
		iconClass: "text-primary",
		type: "PDF",
		size: "2.4 MB",
		receivedDate: "Jun 10, 2026",
	},
	{
		name: "Launch_Banner.png",
		icon: Image,
		iconClass: "text-accent-foreground",
		type: "Image",
		size: "5.1 MB",
		receivedDate: "Jun 10, 2026",
	},
	{
		name: "Budget_Q3.xlsx",
		icon: Table,
		iconClass: "text-green-500",
		type: "Spreadsheet",
		size: "768 KB",
		receivedDate: "Jun 9, 2026",
	},
	{
		name: "ReadMe.txt",
		icon: File,
		iconClass: "text-muted-foreground",
		type: "Text",
		size: "12 KB",
		receivedDate: "Jun 8, 2026",
	},
];
