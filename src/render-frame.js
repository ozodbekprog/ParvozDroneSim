/** A failed post pass must not turn every animation tick into an unhandled exception. */
export function renderFrame({post,direct,reset}) {
  if(post) {
    try {post();return {ok:true};}
    catch(error) {
      reset();
      try {direct();return {ok:true,postError:error};}
      catch(directError) {return {ok:false,error:directError,postError:error};}
    }
  }
  try {direct();return {ok:true};} catch(error) {return {ok:false,error};}
}
