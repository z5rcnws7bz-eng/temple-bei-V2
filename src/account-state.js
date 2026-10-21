// Never apply an in-flight response after another account signed in or signed out.
export function matchesAccountState(expectedId,currentId,responseId){
 return Boolean(expectedId&&expectedId===currentId&&expectedId===responseId);
}
