export default async function miningService() {
  const isSuccessful = Math.random() > 0.7;

  if (isSuccessful) {
    console.log("Mining service call succeeded");
    return "Success";
  }

  console.log("Mining service call failed");
  throw new Error("Mining service call failed");
}
