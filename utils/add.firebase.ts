import { db } from "../firebase/firebase";


async function add({ colletionName, data }: { colletionName: string, data: any }) {
    const ref = db.collection(colletionName).doc();
    await ref.set(data);
    return ref.id
}

export default add  